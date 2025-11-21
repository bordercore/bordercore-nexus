"""Views for the accounts application.

This module contains views for managing user profiles, authentication,
password changes, and user-related operations.
"""
import io
from typing import Any, cast

import boto3

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import (authenticate, login, logout,
                                 update_session_auth_hash)
from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User
from django.contrib.auth.views import PasswordChangeView
from django.core.files.uploadedfile import UploadedFile
from django.forms import BaseModelForm
from django.http import (HttpRequest, HttpResponse, HttpResponseRedirect,
                         JsonResponse)
from django.http.response import HttpResponseBase
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST
from django.views.generic.edit import UpdateView

from accounts.forms import UserProfileForm
from accounts.models import UserNote, UserProfile
from blob.models import Blob
from lib.mixins import FormRequestMixin


@method_decorator(login_required, name="dispatch")
class UserProfileUpdateView(FormRequestMixin, UpdateView):
    """View for updating user profile preferences.

    Handles editing of user profile settings including background images,
    sidebar images, pinned tags, muted drill tags, and Instagram credentials.
    """

    template_name = "prefs/index.html"
    form_class = UserProfileForm

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the user profile update form.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - groups: Comma-separated list of user group names
                - nav: Navigation identifier ("prefs")
                - title: Page title
                - drill_tags_muted: List of muted drill tag names
                - tags: List of pinned tag names (reversed)
                - instagram_username: Instagram username if credentials exist
                - instagram_password: Instagram password if credentials exist
        """
        context = super().get_context_data(**kwargs)
        user = cast(User, self.request.user)
        context["groups"] = ", ".join([x.name for x in user.groups.all()])
        context["nav"] = "prefs"
        context["title"] = "Preferences"
        context["drill_tags_muted"] = [x.name for x in self.object.drill_tags_muted.all()]
        context["tags"] = [x.name for x in self.object.pinned_tags.all()[::-1]]
        if user.userprofile.instagram_credentials:
            context["instagram_username"] = user.userprofile.instagram_credentials.get("username", "")
            context["instagram_password"] = user.userprofile.instagram_credentials.get("password", "")

        return context

    def get_object(self, queryset: Any | None = None) -> UserProfile:
        """Get the user profile object for the current user.

        Args:
            queryset: Optional queryset to use (unused in this implementation).

        Returns:
            The UserProfile instance for the current user.
        """
        user = cast(User, self.request.user)
        return UserProfile.objects.get(user=user)

    def form_valid(self, form: BaseModelForm) -> HttpResponse:
        """Handle a valid form submission.

        Processes sidebar and background image changes, saves Instagram
        credentials, and updates the user profile.

        Args:
            form: The validated user profile form.

        Returns:
            HTTP response with updated context and success message.
        """
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

    def handle_background_image(self, form: BaseModelForm) -> None:
        """Handle background image upload or deletion.

        Manages background image changes including deleting old images from S3,
        uploading new images, and updating the user profile.

        Args:
            form: The user profile form instance.
        """
        background_image_old = form.initial["background_image"]
        background_image_new = self.request.FILES.get("background_image_file", None)

        s3_client = boto3.client("s3")

        if self.request.POST.get("delete_background") == "true":
            user = cast(User, self.request.user)
            # Delete the image from S3
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=f"background/{user.userprofile.uuid}/{background_image_old}"
            )

            # Delete it from the model
            self.object.background_image = None
            self.object.save()

        elif background_image_new and "background_image" in form.changed_data:
            user = cast(User, self.request.user)
            # Delete the old image from S3
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=f"background/{user.userprofile.uuid}/{background_image_old}"
            )

            # Upload the new image to S3
            uploaded_file = cast(UploadedFile, self.request.FILES["background_image_file"])
            key = f"background/{user.userprofile.uuid}/{uploaded_file.name}"
            fo = io.BytesIO(uploaded_file.read())
            s3_client.upload_fileobj(
                fo,
                settings.AWS_STORAGE_BUCKET_NAME,
                key,
                ExtraArgs={"ContentType": "image/jpeg"}
            )

            self.object.background_image = uploaded_file.name
            self.object.save()

            # Edit the user's profile immediately so the new sidebage image
            #  will appear as soon as this view returns the response
            user.userprofile.background_image = uploaded_file.name

    def handle_sidebar(self, form: BaseModelForm) -> None:
        """Handle sidebar image upload or deletion.

        Manages sidebar image changes including deleting old images from S3,
        uploading new images, and updating the user profile.

        Args:
            form: The user profile form instance.
        """
        sidebar_image_old = form.initial["sidebar_image"]
        sidebar_image_new = self.request.FILES.get("sidebar_image_file", None)

        s3_client = boto3.client("s3")

        if self.request.POST.get("delete_sidebar") == "true":
            user = cast(User, self.request.user)
            # Delete the image from S3
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=f"sidebar/{user.userprofile.uuid}/{sidebar_image_old}"
            )

            # Delete it from the model
            self.object.sidebar_image = None
            self.object.save()

        elif sidebar_image_new and "sidebar_image" in form.changed_data:
            user = cast(User, self.request.user)
            # Delete the old image from S3
            s3_client.delete_object(
                Bucket=settings.AWS_STORAGE_BUCKET_NAME,
                Key=f"sidebar/{user.userprofile.uuid}/{sidebar_image_old}"
            )

            # Upload the new image to S3
            uploaded_file = cast(UploadedFile, self.request.FILES["sidebar_image_file"])
            key = f"sidebar/{user.userprofile.uuid}/{uploaded_file.name}"
            fo = io.BytesIO(uploaded_file.read())
            s3_client.upload_fileobj(fo, settings.AWS_STORAGE_BUCKET_NAME, key)

            self.object.sidebar_image = uploaded_file.name
            self.object.save()

            # Edit the user's profile immediately so the new sidebage image
            #  will appear as soon as this view returns the response
            user.userprofile.sidebar_image = uploaded_file.name

    @method_decorator(login_required)
    def dispatch(self, *args: Any, **kwargs: Any) -> HttpResponseBase:
        """Dispatch the request to the appropriate handler method.

        Args:
            *args: Positional arguments.
            **kwargs: Keyword arguments.

        Returns:
            HTTP response from the parent dispatch method.
        """
        return super().dispatch(*args, **kwargs)


@method_decorator(login_required, name="dispatch")
class ChangePasswordView(PasswordChangeView):
    """View for changing user password.

    Handles password change requests with validation for old password
    correctness and new password matching.
    """

    template_name = "prefs/password.html"
    success_url = reverse_lazy("accounts:password")

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Get context data for the password change form.

        Args:
            **kwargs: Additional keyword arguments.

        Returns:
            Context dictionary containing:
                - nav: Navigation identifier ("prefs")
                - title: Page title
        """
        context = super().get_context_data(**kwargs)
        context["nav"] = "prefs"
        context["title"] = "Preferences"
        return context

    def post(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponseRedirect:
        """Handle password change form submission.

        Validates the old password, checks that new passwords match,
        and updates the user's password if validation passes.

        Args:
            request: The HTTP request containing password change data.
            *args: Positional arguments.
            **kwargs: Keyword arguments.

        Returns:
            Redirect to the success URL with appropriate status message.
        """
        user = cast(User, request.user)
        if not check_password(request.POST["old_password"], user.password):
            messages.add_message(request, messages.ERROR, "Incorrect password")
        elif request.POST["new_password1"] != request.POST["new_password2"]:
            messages.add_message(request, messages.ERROR, "New passwords do not match")
        else:
            user.set_password(request.POST["new_password1"])
            user.save()
            update_session_auth_hash(request, user)
            messages.add_message(request, messages.INFO, "Password updated")

        return HttpResponseRedirect(self.get_success_url())


@login_required
@require_POST
def sort_pinned_notes(request: HttpRequest) -> JsonResponse:
    """Reorder a pinned note to a new position.

    Moves a pinned note to a new position in the sorted list of pinned notes.

    Args:
        request: The HTTP request containing:
            - note_uuid: The UUID of the note to reorder
            - new_position: The new position index for the note

    Returns:
        JSON response with operation status.
    """
    note_uuid = request.POST["note_uuid"]
    new_position = int(request.POST["new_position"])

    user = cast(User, request.user)
    s = UserNote.objects.get(userprofile=user.userprofile, blob__uuid=note_uuid)
    UserNote.reorder(s, new_position)

    return JsonResponse({"status": "OK"}, safe=False)


@login_required
@require_POST
def pin_note(request: HttpRequest) -> JsonResponse:
    """Pin or unpin a note for the current user.

    Creates or removes a UserNote association to pin or unpin a note.
    Returns an error if attempting to pin an already pinned note.

    Args:
        request: The HTTP request containing:
            - uuid: The UUID of the note to pin or unpin
            - remove: Whether to remove the pin (optional, defaults to False)

    Returns:
        JSON response containing:
            - status: "OK" on success, "Not OK" on failure
            - message: Error message if status is "Not OK"
    """
    uuid = request.POST["uuid"]
    remove = request.POST.get("remove", False)

    user = cast(User, request.user)
    note = Blob.objects.get(user=user, uuid=uuid)

    message = ""
    status = ""

    if remove:
        sort_order = UserNote.objects.get(userprofile=user.userprofile, blob=note)
        sort_order.delete()
        status = "OK"
    else:
        if UserNote.objects.filter(userprofile=user.userprofile, blob=note).exists():
            message = "That note is already pinned."
            status = "Not OK"
        else:
            c = UserNote(userprofile=user.userprofile, blob=note)
            c.save()
            status = "OK"

    return JsonResponse({"status": status, "message": message}, safe=False)


@login_required
@require_POST
def store_in_session(request: HttpRequest) -> JsonResponse:
    """Store POST data in the session.

    Saves all POST parameters to the session for later retrieval.

    Args:
        request: The HTTP request containing POST data to store.

    Returns:
        JSON response with operation status.
    """
    for key in request.POST:
        request.session[key] = request.POST[key]
    return JsonResponse({"status": "OK"}, safe=False)


def bc_login(request: HttpRequest) -> HttpResponse:
    """Handle user login.

    Authenticates users and logs them into the system. Validates username
    existence, password correctness, and account status. Sets a cookie to
    remember the username for a month.

    Args:
        request: The HTTP request containing:
            - username: The username to authenticate
            - password: The password to verify
            - next: Optional redirect URL after login

    Returns:
        Redirect to the next URL or homepage on successful login,
            or renders the login page with an error message on failure.
    """
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
def bc_logout(request: HttpRequest) -> HttpResponseRedirect:
    """Handle user logout.

    Logs out the current user and redirects to the login page.

    Args:
        request: The HTTP request.

    Returns:
        Redirect to the login page.
    """
    logout(request)
    return redirect("accounts:login")
