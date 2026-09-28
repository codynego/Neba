from django.db import models
class City(models.Model):
    name = models.CharField(max_length=120)
    state = models.CharField(max_length=120)
    country = models.CharField(max_length=2, default="NG")
    class Meta:
        ordering = ("name",)
        constraints = [models.UniqueConstraint(fields=("name", "state", "country"), name="unique_city_location")]
    def __str__(self):
        return f"{self.name}, {self.state}"

