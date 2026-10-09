"""Transparent opportunity matching and recommendation ranking.

The fit score explains how closely an opportunity matches a member's stated
profile. The ranking score is separate: it adds small freshness, deadline and
trust signals so the feed stays useful without presenting popularity as
eligibility.
"""

from collections import Counter
from dataclasses import dataclass, field
from datetime import date
import re

from django.utils import timezone


INTENT_CATEGORIES = {
    "work": {"job", "internship"},
    "learn": {"scholarship", "fellowship", "training"},
    "build": {"startup", "competition"},
    "fund": {"grant", "funding", "tender"},
}

INTEREST_TERMS = {
    "software technology": {"software", "technology", "tech", "developer", "coding", "computer science"},
    "business": {"business", "entrepreneur", "company", "enterprise", "startup"},
    "finance": {"finance", "financial", "accounting", "investment", "fintech"},
    "design": {"design", "designer", "creative", "product design"},
    "engineering": {"engineering", "engineer", "technical"},
    "marketing": {"marketing", "brand", "communications", "growth"},
    "healthcare": {"healthcare", "health", "medical", "clinical"},
    "education": {"education", "teaching", "learning", "academic"},
    "creative work": {"creative", "media", "content", "writing", "arts"},
    "agriculture": {"agriculture", "farming", "agribusiness"},
    "social impact": {"social impact", "nonprofit", "ngo", "community development"},
}

GLOBAL_COUNTRY_TERMS = {"all", "all countries", "any country", "global", "international", "worldwide"}
COUNTRY_GROUPS = (
    {"nigeria", "ng", "nigerian"},
    {"united states", "united states of america", "usa", "us"},
    {"united kingdom", "uk", "great britain", "britain"},
)


def canonical(value):
    return " ".join(re.findall(r"[a-z0-9]+", str(value).casefold()))


def normalized(values):
    return {canonical(value) for value in (values or []) if canonical(value)}


def profile_age(user):
    if not user.date_of_birth:
        return None
    today = date.today()
    return today.year - user.date_of_birth.year - ((today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day))


def phrase_matches(value, text):
    phrase = canonical(value)
    return bool(phrase and re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", text))


def any_text_match(values, text):
    return any(phrase_matches(value, text) for value in (values or []))


def country_matches(country, eligible_countries):
    country = canonical(country)
    eligible = normalized(eligible_countries)
    if eligible & GLOBAL_COUNTRY_TERMS:
        return True
    if country in eligible:
        return True
    for group in COUNTRY_GROUPS:
        if country in group and eligible & group:
            return True
    return False


@dataclass
class MatchContext:
    category_affinity: Counter = field(default_factory=Counter)
    provider_affinity: Counter = field(default_factory=Counter)
    saved_ids: set = field(default_factory=set)
    applied_ids: set = field(default_factory=set)
    archived_ids: set = field(default_factory=set)


def build_match_context(user, include_activity=True):
    context = MatchContext()
    if not include_activity or not getattr(user, "is_authenticated", False):
        return context

    def learn(rows, weight):
        for public_id, category, provider in rows:
            context.category_affinity[category] += weight
            context.provider_affinity[canonical(provider)] += weight
            yield public_id

    saved = list(user.saved_opportunities.select_related("opportunity").values_list(
        "opportunity__public_id", "opportunity__category", "opportunity__provider", "status"
    ))
    for public_id, category, provider, status in saved:
        if status == "archived":
            context.archived_ids.add(public_id)
            continue
        context.saved_ids.add(public_id)
        context.category_affinity[category] += 1
        context.provider_affinity[canonical(provider)] += 1

    application_rows = user.opportunity_applications.select_related("opportunity").values_list(
        "opportunity__public_id", "opportunity__category", "opportunity__provider"
    )
    context.applied_ids.update(learn(application_rows, 3))
    thanks_rows = user.opportunity_thanks.select_related("opportunity").values_list(
        "opportunity__public_id", "opportunity__category", "opportunity__provider"
    )
    list(learn(thanks_rows, 1))
    return context


def match_for(user, opportunity, context=None):
    context = context or MatchContext()
    points = 0
    reasons, missing, conflicts = [], [], []
    breakdown = {"eligibility": 0, "interests": 0, "experience": 0, "location": 0, "activity": 0}
    criteria_total = criteria_checked = criteria_passed = 0
    hard_failure = None

    def criterion(values, profile_value, weight, reason, missing_label, matcher=None, hard=False):
        nonlocal criteria_total, criteria_checked, criteria_passed, hard_failure
        if not values:
            return
        criteria_total += 1
        if not profile_value:
            missing.append(missing_label)
            return
        criteria_checked += 1
        matched = matcher(profile_value, values) if matcher else canonical(profile_value) in normalized(values)
        if matched:
            criteria_passed += 1
            breakdown["eligibility"] += weight
            reasons.append(reason)
        else:
            conflicts.append(missing_label)
            if hard:
                hard_failure = missing_label

    criterion(
        opportunity.eligible_countries,
        user.country,
        14,
        f"Open to applicants in {user.country}" if user.country else "Country requirement matches",
        "Published country criteria may not match your profile",
        country_matches,
        hard=True,
    )
    criterion(opportunity.education_levels, user.education_level, 10, "Matches your education level", "Education level needs checking")

    fields = normalized(opportunity.fields_of_study)
    if fields:
        criteria_total += 1
        if not user.field_of_study:
            missing.append("Field of study needs checking")
        else:
            criteria_checked += 1
            field_text = canonical(user.field_of_study)
            if any(field in field_text or field_text in field for field in fields):
                criteria_passed += 1; breakdown["eligibility"] += 8; reasons.append("Connects with your field of study")
            else:
                conflicts.append("Field of study needs checking")

    criterion(opportunity.employment_statuses, user.employment_status, 6, "Fits your current work status", "Employment status needs checking")

    if opportunity.min_age or opportunity.max_age:
        criteria_total += 1
        age = profile_age(user)
        if age is None:
            missing.append("Age eligibility needs checking")
        else:
            criteria_checked += 1
            if (opportunity.min_age and age < opportunity.min_age) or (opportunity.max_age and age > opportunity.max_age):
                hard_failure = "Outside the published age range"
                conflicts.append(hard_failure)
            else:
                criteria_passed += 1; breakdown["eligibility"] += 6; reasons.append("Age requirement met")

    if opportunity.requires_business:
        criteria_total += 1
        if user.business_status:
            criteria_checked += 1; criteria_passed += 1; breakdown["eligibility"] += 6; reasons.append("Relevant to your business stage")
        else:
            missing.append("Business or project details need checking")

    interests = normalized(user.opportunity_interests)
    goals = normalized(user.goals)
    category_variants = {canonical(opportunity.category), canonical(f"{opportunity.category}s")}
    if interests & category_variants:
        breakdown["interests"] += 18; reasons.append(f"You’re looking for {opportunity.get_category_display().lower()} opportunities")

    intent_match = next((intent for intent, categories in INTENT_CATEGORIES.items() if intent in goals and opportunity.category in categories), None)
    if intent_match:
        breakdown["interests"] += 14; reasons.append(f"Fits your {intent_match} direction")

    if opportunity.is_remote and "remote" in interests:
        breakdown["location"] += 6; reasons.append("Matches your remote preference")

    opportunity_text = canonical(" ".join((
        opportunity.title, opportunity.summary, opportunity.provider, opportunity.benefit,
        opportunity.eligibility_notes, " ".join(opportunity.fields_of_study or []), opportunity.location_label,
    )))
    matched_interests = []
    for interest in interests - category_variants - {"remote"}:
        terms = INTEREST_TERMS.get(interest, {interest})
        if any(phrase_matches(term, opportunity_text) for term in terms):
            matched_interests.append(interest)
    if matched_interests:
        value = min(12, 6 + len(matched_interests) * 2)
        breakdown["interests"] += value; reasons.append("Connects with your interest areas")

    if any_text_match(user.skills, opportunity_text):
        breakdown["experience"] += 10; reasons.append("Uses skills in your profile")
    if any_text_match(user.goals, opportunity_text):
        breakdown["interests"] += 7; reasons.append("Connects with one of your goals")
    if any_text_match([user.industry, user.business_industry, user.field_of_study], opportunity_text):
        breakdown["experience"] += 6; reasons.append("Relevant to your background")

    location_text = canonical(f"{opportunity.location_label} {opportunity.country}")
    if any_text_match([user.city, user.state, user.country], location_text):
        breakdown["location"] += 5; reasons.append("Available in a location that fits your profile")

    activity_value = min(8, context.category_affinity[opportunity.category] * 2)
    activity_value += min(4, context.provider_affinity[canonical(opportunity.provider)])
    if activity_value:
        activity_value = min(activity_value, 10)
        breakdown["activity"] += activity_value
        reasons.append("Similar to opportunities you’ve saved or pursued")

    # Dimension caps keep one rich text field from dominating the result and
    # prevent most complete profiles from collapsing into the same 98% score.
    points = (
        20
        + min(32, breakdown["eligibility"])
        + min(32, breakdown["interests"])
        + min(12, breakdown["experience"])
        + min(8, breakdown["location"])
        + min(8, breakdown["activity"])
    )
    points -= min(18, len(conflicts) * 8)
    if hard_failure:
        points = min(points, 24 if "age" in hard_failure.lower() else 34)

    eligibility = "unlikely" if hard_failure else "eligible" if criteria_total and criteria_checked == criteria_total and criteria_passed == criteria_total else "check" if criteria_total and (missing or conflicts) else "likely"
    profile_signals = sum(bool(value) for value in (user.country, user.education_level, user.field_of_study, user.employment_status, user.skills, user.opportunity_interests, user.goals))
    criteria_coverage = criteria_checked / criteria_total if criteria_total else min(1, profile_signals / 5)
    confidence = "high" if criteria_coverage >= .8 and profile_signals >= 4 else "medium" if criteria_coverage >= .4 and profile_signals >= 2 else "low"
    combined_gaps = list(dict.fromkeys(conflicts + missing))
    return {
        "score": max(0, min(round(points), 98)),
        "eligibility": eligibility,
        "confidence": confidence,
        "reasons": list(dict.fromkeys(reasons))[:4],
        "missing": combined_gaps[:3],
        "breakdown": breakdown,
        "version": "v2",
    }


def recommendation_rank(opportunity, match, context, now=None):
    now = now or timezone.now()
    rank = float(match["score"])
    if opportunity.organization_id and getattr(opportunity.organization, "status", "") == "verified":
        rank += 3
    elif opportunity.created_by_id and getattr(opportunity.created_by, "is_staff", False):
        rank += 2
    rank += min(3, getattr(opportunity, "thanks_count_value", 0) ** .5)
    age_days = max(0, (now - opportunity.created_at).days)
    if age_days <= 7:
        rank += 2
    elif age_days <= 30:
        rank += 1
    if opportunity.deadline:
        days_left = (opportunity.deadline - now).total_seconds() / 86400
        if 0 <= days_left <= 3:
            rank += 3
        elif days_left <= 14:
            rank += 2
        elif days_left <= 30:
            rank += 1
    if opportunity.public_id in context.applied_ids:
        rank -= 14
    elif opportunity.public_id in context.saved_ids:
        rank += 1
    return round(rank, 2)


def rank_opportunities(user, opportunities, context=None, now=None):
    context = context or build_match_context(user)
    ranked = []
    for opportunity in opportunities:
        if opportunity.public_id in context.archived_ids:
            continue
        match = match_for(user, opportunity, context)
        if match["score"] < 50 or match["eligibility"] == "unlikely":
            continue
        ranked.append((recommendation_rank(opportunity, match, context, now), opportunity, match))
    ranked.sort(key=lambda row: (-row[0], row[1].deadline.timestamp() if row[1].deadline else float("inf"), -row[1].created_at.timestamp()))
    return ranked


def diverse_recommendations(ranked, limit=5):
    remaining = list(ranked)
    selected = []
    category_counts, provider_counts = Counter(), Counter()
    while remaining and len(selected) < limit:
        best = max(
            remaining,
            key=lambda row: row[0] - category_counts[row[1].category] * 4 - provider_counts[canonical(row[1].provider)] * 5,
        )
        remaining.remove(best)
        selected.append(best)
        category_counts[best[1].category] += 1
        provider_counts[canonical(best[1].provider)] += 1
    return selected
