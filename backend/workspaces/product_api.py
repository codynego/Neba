from decimal import Decimal
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from .models import Business, Customer, Job


class BusinessSerializer(serializers.ModelSerializer):
    job_count = serializers.SerializerMethodField()

    def get_job_count(self, business):
        return business.jobs.count()

    class Meta:
        model = Business
        fields = ("id", "name", "service_type", "city", "phone", "slug", "job_count", "created_at", "updated_at")
        read_only_fields = ("id", "slug", "job_count", "created_at", "updated_at")


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ("id", "business", "name", "phone", "address", "notes", "created_at")
        read_only_fields = ("id", "business", "created_at")


class JobSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_phone = serializers.CharField(source="customer.phone", read_only=True)
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = ("id", "business", "customer", "customer_name", "customer_phone", "title", "description", "address", "requested_for", "assignee_name", "status", "quote_amount", "deposit_amount", "amount_paid", "payment_status", "balance_due", "source", "ai_summary", "created_at", "updated_at")
        read_only_fields = ("id", "business", "payment_status", "balance_due", "created_at", "updated_at")

    def get_balance_due(self, job):
        return max(Decimal("0"), (job.quote_amount or Decimal("0")) - job.amount_paid)

    def validate(self, attrs):
        business = self.context["business"]
        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        if customer and customer.business_id != business.id:
            raise ValidationError({"customer": "Choose a customer in this workspace."})
        for field in ("quote_amount", "deposit_amount", "amount_paid"):
            value = attrs.get(field)
            if value is not None and value < 0:
                raise ValidationError({field: "Enter zero or a positive amount."})
        return attrs


class WorkspaceOwnerMixin:
    permission_classes = [permissions.IsAuthenticated]

    def business(self):
        business = Business.objects.filter(owner=self.request.user).first()
        if not business:
            raise ValidationError({"detail": "Create your business workspace first."})
        return business


class BusinessViewSet(WorkspaceOwnerMixin, viewsets.ModelViewSet):
    serializer_class = BusinessSerializer

    def get_queryset(self):
        return Business.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        if Business.objects.filter(owner=self.request.user).exists():
            raise ValidationError({"detail": "You already have a business workspace."})
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"])
    def mine(self, request):
        business = Business.objects.filter(owner=request.user).first()
        if not business:
            return Response({"business": None})
        return Response({"business": self.get_serializer(business).data})


class CustomerViewSet(WorkspaceOwnerMixin, viewsets.ModelViewSet):
    serializer_class = CustomerSerializer

    def get_queryset(self):
        return Customer.objects.filter(business=self.business())

    def perform_create(self, serializer):
        serializer.save(business=self.business())


class JobViewSet(WorkspaceOwnerMixin, viewsets.ModelViewSet):
    serializer_class = JobSerializer

    def get_queryset(self):
        queryset = Job.objects.select_related("customer").filter(business=self.business())
        status = self.request.query_params.get("status", "").strip()
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["business"] = self.business()
        return context

    def perform_create(self, serializer):
        serializer.save(business=self.business())

    @action(detail=True, methods=["post"])
    def advance(self, request, pk=None):
        job = self.get_object()
        status = request.data.get("status")
        if status not in Job.Status.values:
            raise ValidationError({"status": "Choose a valid job status."})
        job.status = status
        job.save(update_fields=("status", "payment_status", "updated_at"))
        return Response(self.get_serializer(job).data)
