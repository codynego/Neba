# Neba for Schools: Product Direction, Feature Plan, and Todo List

## Product direction

Neba for Schools should become a simple academic operating system that gradually turns everyday school records into actionable teaching intelligence.

It should not begin as:

- an AI chatbot looking for a use case;
- a result-upload tool that assumes schools already have clean digital data;
- a full school-management ERP competing on fees, payroll, admissions, and payments.

The core promise is:

> Neba helps schools organize academic work, understand where learners need support, choose a teaching response, and measure whether learning improves.

The central loop is:

`school setup → academic records → evidence → teacher action → follow-up evidence → improvement`

The product must be useful before a school has perfect data. Neba should meet schools where they are: paper records, inconsistent spreadsheets, WhatsApp-shared results, and mixed manual workflows.

## Product pillars

### 1. Academic operating layer

This creates the daily habit and the structured data foundation.

- School and academic-session setup
- Classes, subjects, students, and teacher assignments
- Role-based access to school records
- Assessment creation and simple score entry
- Spreadsheet import and export
- Result review and approval
- Academic history and progression
- Useful school summaries and printable outputs

### 2. Academic intelligence layer

This is Neba's differentiation.

- Class and subject performance
- Topic and question-level evidence
- Learners needing teacher review
- Transparent learning-gap signals
- Trends across assessments
- Teacher-owned intervention plans
- Follow-up assessment comparison
- Evidence of improvement

### 3. Teacher action layer

Insights must lead to practical work.

- Revision plans
- Lesson and reteaching sequences
- Practice questions and worksheets
- Differentiated activities
- Remedial exercises
- Teacher review and editing before anything is shared
- Intervention status and follow-up dates

### 4. Trust and data-quality layer

School data is sensitive and often messy. Trust is part of the product, not a later compliance task.

- School-level data isolation
- Precise teacher permissions
- Import validation and correction
- Audit history for score changes
- Clear evidence provenance for every signal
- Human review boundaries around AI
- Retention, export, correction, and deletion controls
- School-data processing terms and incident procedures

## Recommended product position

Use this positioning:

> Neba is a simple academic operating system for schools that turns everyday results into better teaching decisions and measurable learner improvement.

Shorter version:

> Organize academic work. Find learning gaps. Improve teaching.

Avoid positioning Neba as an autonomous system that diagnoses learners or makes high-stakes decisions.

## Phased feature plan

## Phase 0: Validate the real workflow

Goal: understand how schools actually record and use academic information before expanding the product.

### Features and work

- Interview 5–10 private schools.
- Collect anonymized examples of result sheets, class lists, assessment formats, and report cards.
- Document how records move between paper, Excel, WhatsApp, teachers, and proprietors.
- Identify one initial school segment, such as low-to-mid-sized private secondary schools.
- Select one pilot subject and term for the first measurable outcome.
- Decide which records Neba will support first and which will remain out of scope.

### Exit criteria

- At least five schools have described the same urgent academic workflow problem.
- Neba has sample data from real school formats.
- One pilot school agrees to use Neba for a complete assessment cycle.
- The first success metric is defined, for example: improved performance on selected Mathematics topics after intervention.

## Phase 1: School academic foundation

Goal: make Neba useful even when a school has poor or incomplete digital records.

### Priority features

- School setup and academic sessions.
- Terms, classes, subjects, and teacher assignments.
- Student roster with stable school identifiers.
- Bulk student import from common spreadsheet formats.
- Manual student and class entry for schools without clean files.
- Teacher role and class/subject permissions.
- Academic dashboard with students, classes, assessments, and pending work.
- Assessment creation and basic score entry.
- CSV/XLSX result import with mapping preview.
- Import validation for:
  - unknown students;
  - duplicate students;
  - duplicate result rows;
  - invalid scores;
  - missing required columns;
  - class or subject mismatches.
- Correction screen before saving imported data.
- Export back to a clean spreadsheet.
- Basic printable or downloadable result summary.

### Important product principle

Do not force schools to have perfect data before they can start. Let them begin with a roster, a class, a subject, and simple scores. Add richer evidence over time.

### Exit criteria

- A school can be onboarded from an existing spreadsheet or manually in one guided session.
- A teacher can create an assessment and enter results without technical help.
- A proprietor or academic head can view a reliable class and subject summary.
- Every imported score can be traced to its source file and import event.

## Phase 2: Explainable academic intelligence

Goal: show where closer teacher review may help, without making unsupported learner judgments.

### Priority features

- Class performance by subject and assessment.
- Individual assessment history.
- Question-to-topic mapping.
- Topic-tagged and question-level evidence.
- Class and individual topic signals.
- Assessment and term filters.
- Coverage and sample-size indicators.
- Evidence panel showing exactly which assessments and scores produced a signal.
- Transparent confidence states such as:
  - early signal;
  - repeated evidence;
  - insufficient evidence.
- Teacher-review wording instead of permanent labels.
- Comparisons across assessments and classes.
- Explicit handling of missing, absent, and excused scores.
- Configurable school benchmarks rather than only hard-coded thresholds.

### Intelligence rules

- The application calculates scores and statistics deterministically.
- An LLM must not calculate grades or invent learning-gap statistics.
- No topic-level conclusion should be made from total marks alone unless the result is clearly labelled as a broad signal.
- A class signal must not automatically become a student label.
- Every insight must show its data coverage and limitations.

### Exit criteria

- Teachers can explain every surfaced signal using the underlying evidence.
- A signal with too little evidence is visibly marked as early or insufficient.
- Missing and excused scores do not silently become zeroes.
- Pilot teachers agree that the signals are useful and not misleading.

## Phase 3: Teacher action and intervention loop

Goal: turn insight into a recorded teaching response.

### Priority features

- Create an intervention from a class or student signal.
- Choose an intervention type: reteach, revision, practice, diagnostic check, or differentiated activity.
- Record the teacher's rationale and intended audience.
- Generate a teacher-review draft using the selected evidence.
- Generate practice questions, worksheets, and lesson sequences.
- Allow teachers to edit and approve AI-generated material.
- Assign a remedial exercise or follow-up activity.
- Set an intervention owner, status, and review date.
- Record teacher observations without presenting them as diagnoses.
- Keep intervention history attached to the relevant class, topic, and learner.

### AI boundaries

AI may:

- explain an observed pattern;
- draft a lesson or revision activity;
- generate practice material;
- suggest questions for teacher review;
- summarize recorded evidence.

AI may not:

- diagnose a learner;
- invent curriculum facts or results;
- automatically assign a learner to a fixed ability group;
- publish material without teacher review;
- make promotion, exclusion, discipline, or safeguarding decisions.

### Exit criteria

- A teacher can move from a signal to a usable intervention draft in minutes.
- The teacher can edit, approve, assign, and complete the intervention.
- All generated content identifies its source evidence and review status.

## Phase 4: Improvement tracking

Goal: prove that Neba supports better outcomes, not just better reporting.

### Priority features

- Baseline assessment for a selected topic.
- Intervention target and expected review date.
- Follow-up assessment linked to the same topic or objective.
- Before-and-after comparison.
- Student, class, subject, and topic improvement views.
- Intervention completion and outcome status.
- Notes explaining what teaching response was used.
- Distinguish improvement, no clear change, decline, and insufficient evidence.
- Exportable intervention-impact report for academic leadership.

### Measurement rules

- Compare comparable assessments where possible.
- Show sample size and coverage beside every improvement claim.
- Do not claim that an intervention caused improvement unless the evidence supports that interpretation.
- Preserve the original baseline even when later scores are corrected.

### Exit criteria

- A pilot school can select a topic, intervene, and see a defensible follow-up comparison.
- School leaders can identify which interventions were completed and what changed afterward.
- Neba can produce one simple, credible impact report.

## Student intelligence: the learner-level direction

Student intelligence should go beyond identifying strong and weak subjects. Its purpose is to help the school and learner decide what should happen next.

### Intelligence layers

#### Descriptive intelligence

What happened?

- Assessment history
- Topic performance
- Strengths and areas for review
- Attendance and submission context
- Performance over time

#### Diagnostic intelligence

What might explain the pattern?

- Possible misconception patterns from question-level responses
- Prerequisite concepts that may need review
- Inconsistent or declining performance
- Accuracy versus speed patterns where timing data exists
- Missing evidence and confidence limitations

Diagnostic outputs must be framed as possibilities for teacher review, never as diagnoses of ability, motivation, disability, or personal circumstances.

#### Action intelligence

What should happen next?

- Recommend a prerequisite review, diagnostic check, guided practice, or extension activity.
- Suggest a next-best learning task based on the learner's evidence.
- Use student strengths to suggest teaching approaches for weaker topics.
- Create a teacher-owned support plan with a review date.
- Generate personalised practice that the teacher can edit and approve.

#### Adaptive intelligence

Did the response work?

- Compare baseline and follow-up performance.
- Record which intervention was used.
- Distinguish improvement, no clear change, decline, and insufficient evidence.
- Suggest whether to continue, change, or close the support plan.
- Over time, show which teaching responses work best for particular topics and classes.

### Student-facing intelligence

With school approval, students may eventually receive a learner-friendly view showing:

- what they are currently working on;
- what to practise next;
- explanations of common errors;
- progress over time;
- specific encouragement based on real progress;
- questions they can take to their teacher.

The student-facing language should be action-oriented: "Here is your next step," not "Here is your intelligence score." Schools should control whether students and guardians can see these views.

### Data requirements

Different levels of intelligence require different evidence:

| Capability | Minimum evidence |
| --- | --- |
| Topic performance | Scores linked to a topic |
| Possible misconception | Question-level responses and reviewed question mappings |
| Personalised practice | Topic, difficulty, learning objective, and prior attempts |
| Learning behaviour pattern | Repeated comparable attempts, and optionally time or submission data |
| Intervention effectiveness | Baseline, documented response, and comparable follow-up |
| Teaching-strategy insight | Multiple interventions with reliable outcome records |

Neba should not imply a deeper insight than the available evidence supports.

## Phase 5: Broader school operations

Build only after the academic improvement loop is used repeatedly and schools ask for these capabilities.

### Later features

- Attendance tracking.
- Homework and assignment submission.
- Report-card generation.
- Student promotion and progression workflows.
- Parent or guardian portal.
- Timetable and lesson scheduling.
- Fees and payment records.
- Admissions and enrollment.
- Payroll and staff administration.

These features may increase retention, but they should not define Neba's initial identity.

## First pilot scope

Keep the first paid or serious pilot narrow:

- 1–3 schools.
- One academic term.
- One or two subjects, preferably Mathematics and English.
- A manageable number of classes.
- School setup and roster.
- Messy spreadsheet or manual result onboarding.
- Basic score entry and import.
- Topic mapping for selected assessments.
- Explainable academic signals.
- Teacher-reviewed intervention drafts.
- One follow-up assessment.
- One improvement report.

Do not promise a complete ERP during the pilot.

## Prioritised todo list

### P0 — Required for a credible pilot

- [ ] Interview and observe the workflows of 5–10 target schools.
- [ ] Collect anonymized real roster and result-sheet examples.
- [ ] Choose the first school segment and pilot subject.
- [x] Implement robust XLSX and CSV import.
- [x] Add column mapping and import preview.
- [x] Add validation and correction for malformed result data.
- [x] Add import history and source-file provenance.
- [ ] Add clean spreadsheet export.
- [x] Add stable student identifiers and duplicate-resolution workflow.
- [x] Add assessment review and approval/publishing states.
- [x] Add academic session and term filters throughout the intelligence views.
- [x] Add evidence panels for every class and student signal.
- [x] Add transparent confidence states and source-assessment provenance to intelligence signals.
- [x] Replace fixed thresholds with configurable or clearly school-defined benchmarks.
- [x] Add baseline and follow-up assessment linking.
- [x] Add intervention targets, due dates, owners, and outcome status.
- [ ] Add audit history for score and assessment changes.
- [ ] Finalize school-data privacy, retention, export, correction, and deletion rules.
- [ ] Test the full workflow with real teachers and anonymized real data.

### P1 — Required for a useful first product

- [x] Add manual roster creation for schools without usable spreadsheets.
- [ ] Add result-summary and report-card-friendly exports.
- [ ] Add question-level score entry that is practical on mobile and desktop.
- [ ] Add teacher observations linked to an intervention.
- [ ] Add practice-question and worksheet generation with teacher editing.
- [ ] Add intervention assignment and completion tracking.
- [ ] Add student support review that avoids automatic labels.
- [ ] Add class, subject, and assessment trend views.
- [ ] Add learner-level progress timelines.
- [ ] Add teacher-review notes for possible misconceptions.
- [ ] Add next-best-action suggestions tied to evidence.
- [ ] Add strength-transfer suggestions, such as using a learner's stronger representation or skill to support a weaker topic.
- [ ] Add school-level data-quality warnings.
- [ ] Add retryable imports and clear failed-state handling.
- [ ] Add performance testing for large classes and imported result sets.

### P2 — Later expansion

- [ ] Attendance workflow.
- [ ] Homework and assignment submission.
- [ ] Report-card generation.
- [ ] Promotion and progression.
- [ ] Parent portal.
- [ ] Student-facing next-step view with school-controlled visibility.
- [ ] Personalised practice based on prior attempts and reviewed learning objectives.
- [ ] Possible misconception pattern detection from question-level responses.
- [ ] Accuracy-versus-speed and consistency insights when timing data is available.
- [ ] Intervention-effectiveness learning across classes and terms.
- [ ] Timetable.
- [ ] Fees and payments.
- [ ] Admissions.
- [ ] Payroll.

## Success metrics

Measure product value through school behavior and learner outcomes, not feature count.

- Time required to onboard a school.
- Percentage of school records successfully imported or structured.
- Time from result entry to first useful insight.
- Percentage of surfaced signals reviewed by a teacher.
- Percentage of interventions started and completed.
- Percentage of interventions with follow-up evidence.
- Improvement in selected topics after intervention.
- Weekly active teachers.
- Repeat assessment cycles completed per school.
- School renewal or continued usage.

## What Neba should not build yet

- A generic chatbot homepage.
- A full ERP before the academic workflow is proven.
- Automated learner diagnosis.
- Unreviewed AI-generated student reports.
- Predictive labels such as “will fail” or “at risk” without validated evidence.
- Complex dashboards that do not lead to a teacher action.
- A requirement that every school already has clean digital result data.

## Decision rule for future features

Add a feature early only if it does at least one of these:

1. helps a school create or clean academic data;
2. helps a teacher understand evidence;
3. helps a teacher take a concrete action;
4. helps the school measure whether the action worked.

Otherwise, defer it until the core academic improvement loop is working reliably.
