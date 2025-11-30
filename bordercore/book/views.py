import string

from book.models import Book

from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic.list import ListView


class BookListView(LoginRequiredMixin, ListView):

    model = Book
    template_name = "book/index.html"
    context_object_name = "info"
    selected_letter = "A"

    def get_queryset(self):
        if self.args[0]:
            self.selected_letter = self.args[0]

        return Book.objects.filter(user=self.request.user, title__istartswith=self.selected_letter)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        info = []

        for myobject in context["object_list"]:
            info.append({
                "title": myobject.title,
                "author": ", ".join(author.name for author in myobject.author.all()),
                "year": myobject.year,
            })

        context["alphabet"] = string.ascii_uppercase
        context["selected_letter"] = self.selected_letter
        context["cols"] = ["title", "author", "year"]
        context["info"] = info
        return context
