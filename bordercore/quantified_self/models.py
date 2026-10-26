"""Personal measurements, their provenance, and explicit night completeness."""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class DataSource(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "name"], name="qs_source_name")]


class ImportBatch(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    source = models.ForeignKey(DataSource, on_delete=models.PROTECT)
    kind = models.CharField(max_length=20)
    digest = models.CharField(max_length=64)
    rows = models.JSONField(default=list)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    committed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["source", "kind", "digest"], name="qs_import_identity")]


class SleepNight(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField(help_text="Morning date of the noon-to-noon reporting window")
    timezone = models.CharField(max_length=64, default="America/New_York")
    status = models.CharField(max_length=12, default="unreviewed", choices=[
        ("unreviewed", "Unreviewed"), ("complete", "Complete"), ("incomplete", "Incomplete")])
    note = models.TextField(blank=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "date"], name="qs_night_date")]
        ordering = ["-date"]


class Observation(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    source = models.ForeignKey(DataSource, on_delete=models.PROTECT)
    external_id = models.CharField(max_length=200, null=True, blank=True)
    import_batch = models.ForeignKey(ImportBatch, on_delete=models.SET_NULL, null=True, blank=True)
    note = models.TextField(blank=True)
    excluded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        constraints: list[models.BaseConstraint] = [models.UniqueConstraint(fields=["source", "external_id"], name="%(class)s_source_event")]


class AwakeningEvent(Observation):
    occurred_at = models.DateTimeField()
    night = models.ForeignKey(SleepNight, on_delete=models.PROTECT, related_name="events")

    class Meta(Observation.Meta):
        indexes = [models.Index(fields=["user", "occurred_at"])]
        ordering = ["-occurred_at", "-id"]


class Measurement(Observation):
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    timezone = models.CharField(max_length=64, default="America/New_York")
    occurred_at = models.DateTimeField(null=True, blank=True)

    class Meta(Observation.Meta):
        abstract = True
        indexes = [models.Index(fields=["user", "date"])]
        ordering = ["-date", "-time", "-id"]


class WeightReading(Measurement):
    value = models.DecimalField(max_digits=9, decimal_places=3)
    unit = models.CharField(max_length=2, choices=[("lb", "lb"), ("kg", "kg")])
    kilograms = models.DecimalField(max_digits=12, decimal_places=6)

    class Meta(Measurement.Meta):
        constraints = Observation.Meta.constraints + [
            models.CheckConstraint(condition=Q(value__gt=0) & Q(kilograms__gt=0), name="qs_weight_positive"),
            models.CheckConstraint(condition=Q(unit__in=["lb", "kg"]), name="qs_weight_unit"),
        ]


class BloodPressureReading(Measurement):
    systolic = models.PositiveSmallIntegerField()
    diastolic = models.PositiveSmallIntegerField()
    pulse = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta(Measurement.Meta):
        constraints = Observation.Meta.constraints + [
            models.CheckConstraint(condition=Q(systolic__gt=0) & Q(diastolic__gt=0), name="qs_pressure_positive"),
            models.CheckConstraint(condition=Q(pulse__isnull=True) | Q(pulse__gt=0), name="qs_pulse_positive"),
        ]


class CardiacMeasurement(Measurement):
    value = models.DecimalField(max_digits=12, decimal_places=6)

    class Meta(Measurement.Meta):
        abstract = True
        constraints = Observation.Meta.constraints + [
            models.CheckConstraint(condition=Q(value__gt=0), name="%(class)s_positive"),
        ]


class RestingHeartRateReading(CardiacMeasurement):
    """Resting heart rate in beats per minute."""


class HeartRateVariabilityReading(CardiacMeasurement):
    """SDNN heart rate variability in milliseconds."""


class SleepSession(Observation):
    """A source-reported sleep session, including its reported time asleep."""
    date = models.DateField(help_text="Morning date of the noon-to-noon reporting window")
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField()
    asleep_seconds = models.PositiveIntegerField(null=True, blank=True)
    algorithm_version = models.CharField(max_length=64, blank=True)
    source_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta(Observation.Meta):
        ordering = ["-date", "-started_at", "-id"]
        indexes = [models.Index(fields=["user", "date"])]
        constraints = Observation.Meta.constraints + [
            models.CheckConstraint(condition=Q(ended_at__gt=models.F("started_at")), name="qs_sleep_session_order"),
        ]


class SleepInterval(Observation):
    """Original stage intervals; Apple Health can supply these without sessions."""
    STAGES = [(value, value) for value in ("awake", "light", "deep", "rem", "asleep", "restless", "in_bed")]
    date = models.DateField(help_text="Morning date of the noon-to-noon reporting window")
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField()
    stage = models.CharField(max_length=12, choices=STAGES)
    session = models.ForeignKey(SleepSession, on_delete=models.CASCADE, null=True, blank=True, related_name="intervals")

    class Meta(Observation.Meta):
        ordering = ["date", "started_at", "id"]
        indexes = [models.Index(fields=["user", "date"])]
        constraints = Observation.Meta.constraints + [
            models.CheckConstraint(condition=Q(ended_at__gt=models.F("started_at")), name="qs_sleep_interval_order"),
            models.CheckConstraint(condition=Q(stage__in=["awake", "light", "deep", "rem", "asleep", "restless", "in_bed"]), name="qs_sleep_stage"),
        ]
