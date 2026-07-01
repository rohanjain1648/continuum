"""A scripted negotiation used for the 'Play demo' button.

It is engineered to exercise every feature: commitments, decisions,
a clear cross-time CONTRADICTION (budget firm at $40k -> later $55k),
and an 'off the record' line you can forget() on stage.
"""

DEMO_TITLE = "Acme x Northwind — vendor negotiation"

DEMO_SCRIPT = [
    ("Maya (Acme)", "Thanks for hopping on. Quick context: our budget for this rollout is firm at forty thousand dollars for the year."),
    ("Dev (Northwind)", "Understood. At forty thousand we can cover onboarding plus standard support."),
    ("Maya (Acme)", "Great. We also need the integration delivered before the end of Q3, that's a hard deadline for us."),
    ("Dev (Northwind)", "Noted. I'll commit to sending you a full proposal by this Friday."),
    ("Maya (Acme)", "Perfect. And we decided internally to go with the annual plan rather than monthly."),
    ("Dev (Northwind)", "Good call, annual is cheaper. One risk: if we add the analytics module, timelines could slip into Q4."),
    ("Maya (Acme)", "Let's keep analytics out of scope for now then."),
    ("Maya (Acme)", "Honestly, between us, off the record, our actual ceiling could stretch a bit if needed."),
    ("Dev (Northwind)", "Circling back on budget. Looking at the numbers, I think we could actually go up to fifty five thousand to include analytics."),
    ("Maya (Acme)", "Wait, fifty five? Earlier we said the budget was firm at forty."),
    ("Dev (Northwind)", "Right, let me re-check. I'll confirm the final figure in the proposal on Friday."),
]
