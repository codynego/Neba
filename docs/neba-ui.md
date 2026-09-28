# Neba UI

Neba should feel like the fastest way to turn a real-world need into a real-world person who can help. Less browsing. More doing.

## Visual system

The source of truth is `frontend/src/app/globals.css`.

| Token | Value |
| --- | --- |
| Primary | #087F5B |
| Primary dark | #07563F |
| Background | #F8FAF8 |
| Surface | #FFFFFF |
| Text | #111714 |
| Muted | #68736E |
| Border | #E5EAE7 |
| Accent | #DDF5EA |
| Font | Geist, self-hosted by Next.js |
| Controls / cards / sheets | 12px / 16px / 24px |

Use the existing tokens when extending the interface. Green signals actions and availability. Short, human copy and useful tasks carry the interface; decoration stays secondary. Respect reduced motion and keep focus indicators visible.

## Implemented experience

- The public landing page at `/` introduces Neba and links into posting, browsing, and signup. It has no app sidebar or bottom navigation.
- The signed-in home at `/dashboard` centers “What do you need help with?” and passes the description into posting, including through login and registration.
- Task management lives at `/activity`.
- Desktop has a sidebar and a secondary neighborhood introduction. Mobile has Home, Nearby, Post, Activity, and Profile navigation.
- City selection is saved locally; task and people views use the existing API. “Browse all cities” clears the filter.
- Nearby switches between tasks and people. Search and category filtering apply to tasks.
- Task cards show real task details, public neighborhood/city, scheduling, cash reward, and requester.
- Posting has three steps: task, location/reward details, and review. It sends the existing API payload and preserves the entered state when moving between steps or retrying a failed submission.
- Profile uses real account information and API totals for posted tasks and skill offers.
- Skeletons, actionable empty states, retry controls, and a task-posted confirmation cover loading and feedback.

## Product boundaries

The backend currently supports positive cash rewards and an optional reward note. Extras such as food can be described in that note. Standalone non-cash rewards require a backend change.

There is no location coordinate/distance service, ratings, identity verification, messaging, payment processing, or automatic matching. Do not invent distances, ratings, verified badges, helper availability, or matching states. The neighborhood illustration is decorative, not a map.

## Higgsfield exploration

Higgsfield was connected during the update. A public landing-page concept and a separate illustrative neighborhood hero photo were generated with GPT Image 2.5 in the private Neba UI exploration project. The concept informed the final photo-plus-task-card hero. The photo is stored at `frontend/public/images/neba-neighbors.png`; it illustrates a use case and does not depict actual Neba customers.

Project: `95de5d9d-0b08-4bf9-a6c3-503654aae0ba`. Concept job: `5ba459d0-66d1-4ac6-81f4-8be94d41a608`. Hero job: `8a3ef950-6469-4fa3-be88-96eff61065d0`.

For future exploration, generate individual screens rather than a full app in one generation. Suggested first prompt:

> Realistic mobile product UI for Neba, a Nigerian neighborhood task marketplace. Home screen only. Geist typography, background #F8FAF8, white cards, deep emerald #087F5B actions, muted #68736E labels, subtle #E5EAE7 borders, 16px card radius and generous whitespace. Greeting “Hello, neighbor.” and city selector “Benin City”. Primary prompt “What do you need help with?” with a description input. Quick actions for moving, errands, skills, and event help. Task cards lead with the work, public neighborhood, time, and naira reward. Five-item navigation: Home, Nearby, prominent center plus, Activity, Profile. Warm, useful, trustworthy consumer app. No gradients, neon, glassmorphism, fictional verification, or futuristic concept art.
