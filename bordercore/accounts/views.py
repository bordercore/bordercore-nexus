import io

import boto3

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import (authenticate, login, logout,
                                 update_session_auth_hash)
from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User
from django.contrib.auth.views import PasswordChangeView
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils.decorators import method_decorator
from django.views.generic.edit import UpdateView

from accounts.forms import UserProfileForm
from accounts.models import UserNote, UserProfile
from blob.models import Blob
from lib.mixins import FormRequestMixin


@method_decorator(login_required, name="dispatch")
class UserProfileUpdateView(FormRequestMixin, UpdateView):
    template_name = "prefs/index.html"
    form_class = UserProfileForm

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["groups"] = ", ".join([x.name for x in self.request.user.groups.all()])
        context["nav"] = "prefs"
        context["title"] = "Preferences"
        context["drill_tags_muted"] = [x.name for x in self.object.drill_tags_muted.all()]
        context["tags"] = [x.name for x in self.object.pinned_tags.all()[::-1]]
        if self.request.user.userprofile.instagram_credentials:
            context["instagram_username"] = self.request.user.userprofile.instagram_credentials.get("username", "")
            context["instagram_password"] = self.request.user.userprofile.instagram_credentials.get("password", "")

        return context

    def get_object(self, queryset=None):
        return UserProfile.objects.get(user=self.request.user)

    def form_valid(self, form):
        self.handle_sidebar(form)
        self.handle_background_image(form)

        instance = form.save(commit=False)

        if self.request.POST.get("instagram_username", None) and self.request.POST.get("instagram_password", None):
            instance.instagram_credentials = {
                "username": self.request.POST["instagram_username"],
                "password": self.request.POST["instagram_password"]
            }

        instance.save()

        # Save the drill_tags_muted field
        form.save_m2m()

        context = self.get_context_data(form=form)
        context["message"] = "Preferences edited"
        return self.render_to_response(context)

    def handle_background_image(self, form):
        background_image_old = form.initial["background_image"]
        background_image_new = self.request.FILES.get("background_image_file", None)

        s3_client = boto3.client("s3")

        if self.request.POST.get("delete_background") == "true":

            # Delete the image from S3
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=f"background/{self.request.user.userprofile.uuid}/{background_image_old}"
            )

            # Delete it from the model
            self.object.background_image = None
            self.object.save()

        elif background_image_new and "background_image" in form.changed_data:

            # Delete the old image from S3
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=f"background/{self.request.user.userprofile.uuid}/{background_image_old}"
            )

            # Upload the new image to S3
            key = f"background/{self.request.user.userprofile.uuid}/{background_image_new}"
            fo = io.BytesIO(self.request.FILES["background_image_file"].read())
            s3_client.upload_fileobj(
                fo,
                settings.AWS_STORAGE_BUCKET_NAME,
                key,
                ExtraArgs={"ContentType": "image/jpeg"}
            )

            self.object.background_image = background_image_new
            self.object.save()

            # Edit the user's profile immediately so the new sidebage image
            #  will appear as soon as this view returns the response
            self.request.user.userprofile.background_image = background_image_new

    def handle_sidebar(self, form):
        sidebar_image_old = form.initial["sidebar_image"]
        sidebar_image_new = self.request.FILES.get("sidebar_image_file", None)

        s3_client = boto3.client("s3")

        if self.request.POST.get("delete_sidebar") == "true":

            # Delete the image from S3
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=f"sidebar/{self.request.user.userprofile.uuid}/{sidebar_image_old}"
            )

            # Delete it from the model
            self.object.sidebar_image = None
            self.object.save()

        elif sidebar_image_new and "sidebar_image" in form.changed_data:

            # Delete the old image from S3
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=f"sidebar/{self.request.user.userprofile.uuid}/{sidebar_image_old}"
            )

            # Upload the new image to S3
            key = f"sidebar/{self.request.user.userprofile.uuid}/{sidebar_image_new}"
            fo = io.BytesIO(self.request.FILES["sidebar_image_file"].read())
            s3_client.upload_fileobj(fo, settings.AWS_STORAGE_BUCKET_NAME, key)

            self.object.sidebar_image = sidebar_image_new
            self.object.save()

            # Edit the user's profile immediately so the new sidebage image
            #  will appear as soon as this view returns the response
            self.request.user.userprofile.sidebar_image = sidebar_image_new

    @method_decorator(login_required)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)


@method_decorator(login_required, name="dispatch")
class ChangePasswordView(PasswordChangeView):
    template_name = "prefs/password.html"
    success_url = reverse_lazy("accounts:password")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["nav"] = "prefs"
        context["title"] = "Preferences"
        return context

    def post(self, request, *args, **kwargs):

        if not check_password(request.POST["old_password"], request.user.password):
            messages.add_message(request, messages.ERROR, "Incorrect password")
        elif request.POST["new_password1"] != request.POST["new_password2"]:
            messages.add_message(request, messages.ERROR, "New passwords do not match")
        else:
            request.user.set_password(request.POST["new_password1"])
            request.user.save()
            update_session_auth_hash(request, request.user)
            messages.add_message(request, messages.INFO, "Password updated")

        return HttpResponseRedirect(self.get_success_url())


@login_required
def sort_pinned_notes(request):
    """
    Move a given tag to a new position in a sorted list
    """

    note_uuid = request.POST["note_uuid"]
    new_position = int(request.POST["new_position"])

    s = UserNote.objects.get(userprofile=request.user.userprofile, note__uuid=note_uuid)
    UserNote.reorder(s, new_position)

    return JsonResponse({"status": "OK"}, safe=False)


@login_required
def pin_note(request):

    uuid = request.POST["uuid"]
    remove = request.POST.get("remove", False)

    note = Blob.objects.get(user=request.user, uuid=uuid)

    message = ""
    status = ""

    if remove:
        sort_order = UserNote.objects.get(userprofile=request.user.userprofile, note=note)
        sort_order.delete()
        status = "OK"
    else:
        if UserNote.objects.filter(userprofile=request.user.userprofile, note=note).exists():
            message = "That note is already pinned."
            status = "Not OK"
        else:
            c = UserNote(userprofile=request.user.userprofile, note=note)
            c.save()
            status = "OK"

    return JsonResponse({"status": status, "message": message}, safe=False)


@login_required
def store_in_session(request):

    for key in request.POST:
        request.session[key] = request.POST[key]
    return JsonResponse({"status": "OK"}, safe=False)


def bc_login(request):

    message = ""

    if "username" in request.POST:

        username = request.POST["username"]
        password = request.POST["password"]

        if not User.objects.filter(username=username).exists():
            message = "Username does not exist"
        else:
            user = authenticate(username=username, password=password)
            if user is not None:
                if user.is_active:
                    login(request, user)
                    response = redirect(request.POST.get("next", "homepage:homepage"))
                    # Remember the username for a month
                    response.set_cookie("bordercore_username", username, max_age=2592000)
                    return response
                message = "Disabled account"
            else:
                message = "Invalid login"

    return render(request, "login.html", {
        "message": message,
        "next": request.GET.get("next")
    })


@login_required
def bc_logout(request):
    logout(request)
    return redirect("accounts:login")
