"""Views for the accounts application.

This module contains views for managing user profiles, authentication,
password changes, and user-related operations.
"""
from typing import Any, cast

from django.contrib import messages
from django.contrib.auth import (authenticate, login, logout,
                                 update_session_auth_hash)
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.contrib.auth.views import PasswordChangeView
from django.core.files.uploadedfile import UploadedFile
from django.forms import BaseModelForm
from django.http import (HttpRequest, HttpResponse, HttpResponseRedirect,
                         JsonResponse)
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_POST
from django.views.generic.edit import UpdateView

from accounts.forms import UserProfileForm
from accounts.models import UserNote, UserProfile
from accounts.services import delete_profile_image, upload_profile_image
from blob.models import Blob
from lib.decorators import validate_post_data
from lib.mixins import FormRequestMixin


class UserProfileUpdateView(LoginRequiredMixin, FormRequestMixin, UpdateView):
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
                - instagram_username: Instagram username if credentials exist
                - instagram_password: Instagram password if credentials exist
        """
        context = super().get_context_data(**kwargs)
        user = cast(User, self.request.user)
        context["groups"] = ", ".join([x.name for x in user.groups.all()])
        context["nav"] = "prefs"
        context["title"] = "Preferences"
        context["drill_tags_muted"] = [x.name for x in self.object.drill_tags_muted.all()]
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
            Redirect to the preferences page with a success message.
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

        messages.success(self.request, "Preferences edited")
        return redirect("accounts:prefs")  # or whatever route

    def _handle_s3_image(
        self,
        *,
        form: BaseModelForm,
        field_name: str,
        file_field_name: str,
        delete_flag_name: str,
        s3_prefix: str,
    ) -> None:
        """Shared handler for S3-backed profile image fields.

        Handles delete requests and uploads of new images, updating the model
        field and deleting any previous object from S3.

        Args:
            form: The bound form instance.
            field_name: Name of the model field (e.g. "background_image").
            file_field_name: Key in ``request.FILES`` (e.g. "background_image_file").
            delete_flag_name: Key in ``request.POST`` for delete flag.
            s3_prefix: S3 key prefix (e.g. "background" or "sidebar").
        """
        user = cast(User, self.request.user)
        profile_uuid = str(user.userprofile.uuid)

        old_name = form.initial.get(field_name)
        uploaded_file = cast(
            UploadedFile | None,
            self.request.FILES.get(file_field_name),
        )
        delete_requested = self.request.POST.get(delete_flag_name) == "true"

        # Delete branch
        if delete_requested:
            if old_name:
                delete_profile_image(profile_uuid, s3_prefix, old_name)

            setattr(self.object, field_name, None)
            self.object.save()
            return

        # Upload branch
        if uploaded_file and field_name in form.changed_data:
            # Delete previous object, if any
            if old_name:
                delete_profile_image(profile_uuid, s3_prefix, old_name)

            filename = uploaded_file.name or "upload"
            upload_profile_image(
                profile_uuid,
                s3_prefix,
                filename,
                uploaded_file.file,
                content_type=uploaded_file.content_type,
            )

            # Update the profile field
            setattr(self.object, field_name, filename)
            self.object.save()

            # Mirror onto the user's profile instance in case templates
            # are using that object directly
            setattr(user.userprofile, field_name, uploaded_file.name)

    def handle_background_image(self, form: BaseModelForm) -> None:
        """Handle background image upload or deletion."""
        self._handle_s3_image(
            form=form,
            field_name="background_image",
            file_field_name="background_image_file",
            delete_flag_name="delete_background",
            s3_prefix="background",
        )

    def handle_sidebar(self, form: BaseModelForm) -> None:
        """Handle sidebar image upload or deletion."""
        self._handle_s3_image(
            form=form,
            field_name="sidebar_image",
            file_field_name="sidebar_image_file",
            delete_flag_name="delete_sidebar",
            s3_prefix="sidebar",
        )


class ChangePasswordView(LoginRequiredMixin, PasswordChangeView):
    """
    View for changing the current user's password using Django's built-in
    PasswordChangeForm and password validation framework, with all feedback
    going through the Django messages framework.
    """

    template_name = "prefs/password.html"
    success_url = reverse_lazy("accounts:password")

    def form_valid(self, form: PasswordChangeForm) -> HttpResponse:
        """Process valid form submission for password change.

        Saves the new password using Django's validators, keeps the user
        logged in, and adds a success message to the messages framework.

        Args:
            form: The validated password change form.

        Returns:
            HTTP response redirecting to the success URL.
        """
        user = form.save()
        update_session_auth_hash(self.request, user)

        messages.success(self.request, "Your password has been updated.")
        return super().form_valid(form)

    def form_invalid(self, form: PasswordChangeForm) -> HttpResponse:
        """Handle an invalid form submission.

        Pushes all relevant errors into the messages framework so that
        base.html can render them.

        Args:
            form: The invalid password change form.

        Returns:
            HTTP response rendering the form with error messages.
        """
        # Non-field errors (e.g. "Your old password was entered incorrectly")
        for error in form.non_field_errors():
            messages.error(self.request, str(error))

        # Field-specific errors
        for field_name, field_errors in form.errors.items():
            for error in field_errors:
                error_str = str(error)
                if field_name == "__all__":
                    messages.error(self.request, error_str)
                else:
                    messages.error(self.request, f"{field_name}: {error_str}")

        # Let the base view re-render the form with errors as well
        return super().form_invalid(form)


@login_required
@require_POST
@validate_post_data("note_uuid", "new_position")
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
    user_note = UserNote.objects.get(userprofile=user.userprofile, blob__uuid=note_uuid)
    UserNote.reorder(user_note, new_position)

    return JsonResponse({"status": "OK"})


@login_required
@require_POST
@validate_post_data("uuid")
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
            - status: "OK" on success, "ERROR" on failure
            - message: Error message if status is "ERROR"
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
            status = "ERROR"
        else:
            user_note = UserNote(userprofile=user.userprofile, blob=note)
            user_note.save()
            status = "OK"

    return JsonResponse({"status": status, "message": message})


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
    return JsonResponse({"status": "OK"})


def bordercore_login(request: HttpRequest) -> HttpResponse:
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
def bordercore_logout(request: HttpRequest) -> HttpResponseRedirect:
    """Handle user logout.

    Logs out the current user and redirects to the login page.

    Args:
        request: The HTTP request.

    Returns:
        Redirect to the login page.
    """
    logout(request)
    return redirect("accounts:login")


@login_required
def get_weather(request: HttpRequest) -> JsonResponse:
    """Get the current user's weather data.

    Returns the weather information stored in the user's profile.

    Args:
        request: The HTTP request.

    Returns:
        JSON response containing:
            - weather: The weather data object (or None if not available)
    """
    user = cast(User, request.user)
    weather_data = user.userprofile.weather if hasattr(user, "userprofile") else None

    return JsonResponse({"weather": weather_data})
