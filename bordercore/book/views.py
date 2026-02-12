import json
import string
from typing import Any, cast

from book.models import Book

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db.models import QuerySet
from django.views.generic.list import ListView


class BookListView(LoginRequiredMixin, ListView):

    model = Book
    template_name = "book/index.html"
    context_object_name = "info"
    selected_letter = "A"

    def get_queryset(self) -> QuerySet[Book]:
        if self.args[0]:
            self.selected_letter = self.args[0]

        user = cast(User, self.request.user)
        return Book.objects.filter(user=user, title__istartswith=self.selected_letter)

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        context = super().get_context_data(**kwargs)

        info = []

        for myobject in context["object_list"]:
            info.append({
                "title": myobject.title,
                "author": ", ".join(author.name for author in myobject.author.all()),
                "year": myobject.year,
            })

        context["alphabet"] = list(string.ascii_uppercase)
        context["alphabet_json"] = json.dumps(list(string.ascii_uppercase))
        context["selected_letter"] = self.selected_letter
        context["cols"] = ["title", "author", "year"]
        context["info"] = json.dumps(info)
        return context
