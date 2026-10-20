from django.db import migrations
from django.utils.text import slugify


def seed_profiles(apps, schema_editor):
    Opportunity = apps.get_model("opportunities", "Opportunity")
    OpportunityProfile = apps.get_model("opportunities", "OpportunityProfile")
    profile_types = {"training": "training", "startup": "accelerator", "scholarship": "programme", "fellowship": "programme"}
    used_slugs = set(OpportunityProfile.objects.values_list("slug", flat=True))
    for provider in Opportunity.objects.exclude(provider="").values_list("provider", flat=True).distinct():
        name = provider.strip()
        if not name:
            continue
        profile = OpportunityProfile.objects.filter(name__iexact=name).first()
        if not profile:
            base = slugify(name)[:180] or "opportunity-provider"
            slug = base
            suffix = 2
            while slug in used_slugs:
                slug = f"{base[:190 - len(str(suffix))]}-{suffix}"
                suffix += 1
            profile = OpportunityProfile.objects.create(name=name, slug=slug, profile_type="organization")
            used_slugs.add(slug)
        categories = list(Opportunity.objects.filter(provider=provider).values_list("category", flat=True))
        category = categories[0] if categories else ""
        profile_type = profile_types.get(category)
        if profile_type and profile.profile_type == "organization":
            profile.profile_type = profile_type
            profile.save(update_fields=("profile_type", "updated_at"))
        Opportunity.objects.filter(provider=provider, profile__isnull=True).update(profile=profile)


class Migration(migrations.Migration):
    dependencies = [("opportunities", "0018_opportunityprofile_communityinsight_and_more")]
    operations = [migrations.RunPython(seed_profiles, migrations.RunPython.noop)]
