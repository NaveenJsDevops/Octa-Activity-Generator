from typing import List, Dict, Any

DEFAULT_ACTIVITY_TYPES: List[Dict[str, Any]] = [
    {
        "activity_type_id": "at-001",
        "name": "Worksheet",
        "description": "Printable activity sheet with structured tasks and learning exercises",
    },
    {
        "activity_type_id": "at-002",
        "name": "Hands-on Project",
        "description": "Practical crafting, building, or design project with physical materials",
    },
    {
        "activity_type_id": "at-003",
        "name": "Science Experiment",
        "description": "Hands-on scientific inquiry, demonstration, and observation",
    },
    {
        "activity_type_id": "at-004",
        "name": "Investigation",
        "description": "Research, inquiry, and analytical study into real-world phenomena",
    },
    {
        "activity_type_id": "at-005",
        "name": "Role Play & Storytelling",
        "description": "Imaginative dramatization, dialogue, and narrative exploration",
    },
    {
        "activity_type_id": "at-006",
        "name": "Game & Puzzle",
        "description": "Educational gameplay, riddles, challenges, and logic puzzles",
    },
    {
        "activity_type_id": "at-007",
        "name": "Observation & Fieldwork",
        "description": "Outdoor, nature, or community observation and documentation",
    },
]

DEFAULT_INTELLIGENCES: List[Dict[str, Any]] = [
    {
        "intelligence_id": "INT-AT",
        "name": "Artistic",
        "description": "Visual arts, craftsmanship, styling, and aesthetic expression",
    },
    {
        "intelligence_id": "INT-AR",
        "name": "Arithmetic",
        "description": "Data analysis, financial literacy, calculations, and mathematical thinking",
    },
    {
        "intelligence_id": "INT-CM",
        "name": "Communication",
        "description": "Listening, verbal storytelling, and written expression",
    },
    {
        "intelligence_id": "INT-CO",
        "name": "Cognitive",
        "description": "Critical thinking, conceptualization, logical reasoning, and observation",
    },
    {
        "intelligence_id": "INT-CR",
        "name": "Creative",
        "description": "Abstract thinking, curiosity, experimentation, and imaginative world-building",
    },
    {
        "intelligence_id": "INT-EM",
        "name": "Emotional",
        "description": "Mindfulness, self-awareness, motivation, and emotional self-regulation",
    },
    {
        "intelligence_id": "INT-EN",
        "name": "Environmental",
        "description": "Eco-awareness, conservation, ecosystems, and spatial environmental awareness",
    },
    {
        "intelligence_id": "INT-SO",
        "name": "Social",
        "description": "Collaboration, leadership, empathy, conflict resolution, and trust-building",
    },
]

DEFAULT_SKILLS: List[Dict[str, Any]] = [
    # Artistic (INT-AT)
    {"skill_id": "SK-AT01", "intelligence_id": "INT-AT", "name": "Artistic Expression", "description": "Expressing ideas through diverse artistic styles and visual forms"},
    {"skill_id": "SK-AT02", "intelligence_id": "INT-AT", "name": "Craftsmanship", "description": "Technique, mastery of materials, and artwork analysis"},

    # Arithmetic (INT-AR)
    {"skill_id": "SK-AR01", "intelligence_id": "INT-AR", "name": "Data Analysis", "description": "Analyzing data, charts, probability, and statistics"},
    {"skill_id": "SK-AR02", "intelligence_id": "INT-AR", "name": "Financial Literacy", "description": "Budgeting, investing, savings, and financial concepts"},
    {"skill_id": "SK-AR03", "intelligence_id": "INT-AR", "name": "Mathematical Thinking & Calculations", "description": "Mental math, numerical problem-solving, and time management"},
    {"skill_id": "SK-AR04", "intelligence_id": "INT-AR", "name": "Numerical Patterns", "description": "Recognizing numerical patterns and sequences"},

    # Communication (INT-CM)
    {"skill_id": "SK-CM01", "intelligence_id": "INT-CM", "name": "Listening", "description": "Active listening, feedback mechanisms, and non-verbal cues"},
    {"skill_id": "SK-CM02", "intelligence_id": "INT-CM", "name": "Verbal Expression", "description": "Storytelling, spoken dialogue, and audience adaptation"},
    {"skill_id": "SK-CM03", "intelligence_id": "INT-CM", "name": "Written Expression", "description": "Structuring information, essay writing, and style comparison"},

    # Cognitive (INT-CO)
    {"skill_id": "SK-CO01", "intelligence_id": "INT-CO", "name": "Conceptualization", "description": "Abstract thinking, mind mapping, and divergence/convergence"},
    {"skill_id": "SK-CO02", "intelligence_id": "INT-CO", "name": "Critical Thinking", "description": "Analysis, bias detection, evaluation, questioning, and synthesis"},
    {"skill_id": "SK-CO03", "intelligence_id": "INT-CO", "name": "Decision-Making", "description": "Decision trees and risk assessment"},
    {"skill_id": "SK-CO04", "intelligence_id": "INT-CO", "name": "Logical Reasoning", "description": "Abductive reasoning, analogies, coding-decoding, and puzzles"},
    {"skill_id": "SK-CO05", "intelligence_id": "INT-CO", "name": "Observation", "description": "Comparing context, identifying similarities/differences, and pattern recognition"},
    {"skill_id": "SK-CO06", "intelligence_id": "INT-CO", "name": "Systems Thinking", "description": "Understanding interconnected systems and resource management"},

    # Creative (INT-CR)
    {"skill_id": "SK-CR01", "intelligence_id": "INT-CR", "name": "Abstract Thinking", "description": "Metaphorical, symbolic, and analogical reasoning"},
    {"skill_id": "SK-CR02", "intelligence_id": "INT-CR", "name": "Adaptability", "description": "Iterative thinking, perspective shifting, and strategic flexibility"},
    {"skill_id": "SK-CR03", "intelligence_id": "INT-CR", "name": "Curiosity", "description": "In-depth exploration and investigating anomalies"},
    {"skill_id": "SK-CR04", "intelligence_id": "INT-CR", "name": "Experimentation", "description": "Hypothesis testing, learning from mistakes, and prototyping"},
    {"skill_id": "SK-CR05", "intelligence_id": "INT-CR", "name": "Exploration", "description": "Conceptual mapping and cross-disciplinary inquiry"},
    {"skill_id": "SK-CR06", "intelligence_id": "INT-CR", "name": "Imagination", "description": "Idea generation, narrative thinking, and world-building"},
    {"skill_id": "SK-CR07", "intelligence_id": "INT-CR", "name": "Lateral Thinking", "description": "Divergent thinking, non-linear problem solving, and unconventional approaches"},

    # Emotional (INT-EM)
    {"skill_id": "SK-EM01", "intelligence_id": "INT-EM", "name": "Mindfulness", "description": "Mental clarity and present-moment awareness"},
    {"skill_id": "SK-EM02", "intelligence_id": "INT-EM", "name": "Positive Reinforcement", "description": "Celebrating achievements and recognition of effort"},
    {"skill_id": "SK-EM03", "intelligence_id": "INT-EM", "name": "Self-Awareness", "description": "Recognizing emotions, understanding triggers, and self-reflection"},
    {"skill_id": "SK-EM04", "intelligence_id": "INT-EM", "name": "Self-Motivation", "description": "Intrinsic motivation, focus, and overcoming obstacles"},
    {"skill_id": "SK-EM05", "intelligence_id": "INT-EM", "name": "Self-Regulation", "description": "Impulse control, stress management, and goal orientation"},

    # Environmental (INT-EN)
    {"skill_id": "SK-EN01", "intelligence_id": "INT-EN", "name": "Eco-Awareness", "description": "Biodiversity, ecosystems, sustainable resource management, and policy"},
    {"skill_id": "SK-EN02", "intelligence_id": "INT-EN", "name": "Spatial Awareness", "description": "Geospatial mapping, habitat changes, and land use"},

    # Social (INT-SO)
    {"skill_id": "SK-SO01", "intelligence_id": "INT-SO", "name": "Collaboration", "description": "Role distribution, shared goal setting, and teamwork strategies"},
    {"skill_id": "SK-SO02", "intelligence_id": "INT-SO", "name": "Conflict Resolution", "description": "Mediation, negotiation, and win-win solutions"},
    {"skill_id": "SK-SO03", "intelligence_id": "INT-SO", "name": "Constructive Feedback", "description": "Constructive criticism and growth-oriented feedback"},
    {"skill_id": "SK-SO04", "intelligence_id": "INT-SO", "name": "Empathy", "description": "Emotional sensitivity, perspective-taking, and understanding others"},
    {"skill_id": "SK-SO05", "intelligence_id": "INT-SO", "name": "Group Dynamics", "description": "Consensus building, team behavior, and team roles"},
    {"skill_id": "SK-SO06", "intelligence_id": "INT-SO", "name": "Leadership", "description": "Leading by example, leadership styles, and team coordination"},
    {"skill_id": "SK-SO07", "intelligence_id": "INT-SO", "name": "Trust-Building", "description": "Accountability, reliability, and consistency in actions"},
]

DEFAULT_SUBSKILLS: List[Dict[str, Any]] = [
    # Artistic (AT01 - AT08)
    {"sub_skill_id": "AT01", "skill_id": "SK-AT01", "name": "Comparing Different Art Styles in Texts", "description": None},
    {"sub_skill_id": "AT02", "skill_id": "SK-AT01", "name": "Emotional Expression", "description": None},
    {"sub_skill_id": "AT03", "skill_id": "SK-AT01", "name": "Exploring Visual Art Techniques", "description": None},
    {"sub_skill_id": "AT04", "skill_id": "SK-AT01", "name": "Figurative Expression", "description": None},
    {"sub_skill_id": "AT05", "skill_id": "SK-AT01", "name": "Naturalistic Expression", "description": None},
    {"sub_skill_id": "AT06", "skill_id": "SK-AT01", "name": "Spatial Elemental Expressions", "description": None},
    {"sub_skill_id": "AT07", "skill_id": "SK-AT01", "name": "Surrealistic Expression", "description": None},
    {"sub_skill_id": "AT08", "skill_id": "SK-AT02", "name": "Analyzing Elements of Artwork", "description": None},

    # Arithmetic (AR01 - AR09)
    {"sub_skill_id": "AR01", "skill_id": "SK-AR01", "name": "Graphing and Charting", "description": None},
    {"sub_skill_id": "AR02", "skill_id": "SK-AR01", "name": "Probability & Statistics", "description": None},
    {"sub_skill_id": "AR03", "skill_id": "SK-AR02", "name": "Budgeting", "description": None},
    {"sub_skill_id": "AR04", "skill_id": "SK-AR02", "name": "Investing", "description": None},
    {"sub_skill_id": "AR05", "skill_id": "SK-AR02", "name": "Savings", "description": None},
    {"sub_skill_id": "AR06", "skill_id": "SK-AR03", "name": "Mental Math Strategies", "description": None},
    {"sub_skill_id": "AR07", "skill_id": "SK-AR03", "name": "Problem Solving with Numbers", "description": None},
    {"sub_skill_id": "AR08", "skill_id": "SK-AR03", "name": "Time Management & Scheduling", "description": None},
    {"sub_skill_id": "AR09", "skill_id": "SK-AR04", "name": "Recognizing Numerical Patterns & Sequences", "description": None},

    # Communication (CM01 - CM15)
    {"sub_skill_id": "CM01", "skill_id": "SK-CM01", "name": "Active Listening", "description": None},
    {"sub_skill_id": "CM02", "skill_id": "SK-CM01", "name": "Feedback Mechanisms", "description": None},
    {"sub_skill_id": "CM03", "skill_id": "SK-CM01", "name": "Non-Verbal Cues", "description": None},
    {"sub_skill_id": "CM04", "skill_id": "SK-CM02", "name": "Adapting Stories for Different Audiences", "description": None},
    {"sub_skill_id": "CM05", "skill_id": "SK-CM02", "name": "Expressing Emotion in Stories", "description": None},
    {"sub_skill_id": "CM06", "skill_id": "SK-CM02", "name": "Improvising a Story", "description": None},
    {"sub_skill_id": "CM07", "skill_id": "SK-CM02", "name": "Structuring a Story", "description": None},
    {"sub_skill_id": "CM08", "skill_id": "SK-CM02", "name": "Telling Engaging Stories", "description": None},
    {"sub_skill_id": "CM09", "skill_id": "SK-CM02", "name": "Using Dialogue Effectively", "description": None},
    {"sub_skill_id": "CM10", "skill_id": "SK-CM03", "name": "Comparing Different Writing Styles", "description": None},
    {"sub_skill_id": "CM11", "skill_id": "SK-CM03", "name": "Comparing Technical Language with Everyday Language", "description": None},
    {"sub_skill_id": "CM12", "skill_id": "SK-CM03", "name": "Organizing Information for Clarity", "description": None},
    {"sub_skill_id": "CM13", "skill_id": "SK-CM03", "name": "Simplifying Complex Ideas into Plain Language", "description": None},
    {"sub_skill_id": "CM14", "skill_id": "SK-CM03", "name": "Structuring Information Logically", "description": None},
    {"sub_skill_id": "CM15", "skill_id": "SK-CM03", "name": "Writing Clear and Organized Essays", "description": None},

    # Cognitive (CO01 - CO22)
    {"sub_skill_id": "CO01", "skill_id": "SK-CO01", "name": "Abstract vs Concrete Thinking", "description": None},
    {"sub_skill_id": "CO02", "skill_id": "SK-CO01", "name": "Divergence & Convergence", "description": None},
    {"sub_skill_id": "CO03", "skill_id": "SK-CO01", "name": "Mind Maps", "description": None},
    {"sub_skill_id": "CO04", "skill_id": "SK-CO02", "name": "Analysis", "description": None},
    {"sub_skill_id": "CO05", "skill_id": "SK-CO02", "name": "Biases", "description": None},
    {"sub_skill_id": "CO06", "skill_id": "SK-CO02", "name": "Evaluation", "description": None},
    {"sub_skill_id": "CO07", "skill_id": "SK-CO02", "name": "Questioning", "description": None},
    {"sub_skill_id": "CO08", "skill_id": "SK-CO02", "name": "Synthesis", "description": None},
    {"sub_skill_id": "CO09", "skill_id": "SK-CO03", "name": "Decision Trees", "description": None},
    {"sub_skill_id": "CO10", "skill_id": "SK-CO03", "name": "Risk Assessment", "description": None},
    {"sub_skill_id": "CO11", "skill_id": "SK-CO04", "name": "Abductive Reasoning", "description": None},
    {"sub_skill_id": "CO12", "skill_id": "SK-CO04", "name": "Analogies", "description": None},
    {"sub_skill_id": "CO13", "skill_id": "SK-CO04", "name": "Blood Relations", "description": None},
    {"sub_skill_id": "CO14", "skill_id": "SK-CO04", "name": "Cause & Effect", "description": None},
    {"sub_skill_id": "CO15", "skill_id": "SK-CO04", "name": "Coding-Decoding", "description": None},
    {"sub_skill_id": "CO16", "skill_id": "SK-CO04", "name": "Logical Diagrams & Puzzles", "description": None},
    {"sub_skill_id": "CO17", "skill_id": "SK-CO04", "name": "Problem-Solving Puzzles", "description": None},
    {"sub_skill_id": "CO18", "skill_id": "SK-CO05", "name": "Comparing Content & Context", "description": None},
    {"sub_skill_id": "CO19", "skill_id": "SK-CO05", "name": "Identifying Similarities & Differences", "description": None},
    {"sub_skill_id": "CO20", "skill_id": "SK-CO05", "name": "Pattern Recognition", "description": None},
    {"sub_skill_id": "CO21", "skill_id": "SK-CO06", "name": "Interconnected Systems", "description": None},
    {"sub_skill_id": "CO22", "skill_id": "SK-CO06", "name": "Resource Management", "description": None},

    # Creative (CR01 - CR29)
    {"sub_skill_id": "CR01", "skill_id": "SK-CR01", "name": "Abstract Problem-Solving", "description": None},
    {"sub_skill_id": "CR02", "skill_id": "SK-CR01", "name": "Analogical Thinking", "description": None},
    {"sub_skill_id": "CR03", "skill_id": "SK-CR01", "name": "Conceptual Differentiation", "description": None},
    {"sub_skill_id": "CR04", "skill_id": "SK-CR01", "name": "Metaphorical Reasoning", "description": None},
    {"sub_skill_id": "CR05", "skill_id": "SK-CR01", "name": "Symbolic Thinking", "description": None},
    {"sub_skill_id": "CR06", "skill_id": "SK-CR02", "name": "Iterative Thinking", "description": None},
    {"sub_skill_id": "CR07", "skill_id": "SK-CR02", "name": "Perspective Shifting", "description": None},
    {"sub_skill_id": "CR08", "skill_id": "SK-CR02", "name": "Problem-Solving Variability", "description": None},
    {"sub_skill_id": "CR09", "skill_id": "SK-CR02", "name": "Resilience in Creativity", "description": None},
    {"sub_skill_id": "CR10", "skill_id": "SK-CR02", "name": "Scenario Flexibility", "description": None},
    {"sub_skill_id": "CR11", "skill_id": "SK-CR02", "name": "Strategic Thinking", "description": None},
    {"sub_skill_id": "CR12", "skill_id": "SK-CR03", "name": "Exploring the Unknown", "description": None},
    {"sub_skill_id": "CR13", "skill_id": "SK-CR03", "name": "In-depth Exploration", "description": None},
    {"sub_skill_id": "CR14", "skill_id": "SK-CR03", "name": "Investigating Anomalies", "description": None},
    {"sub_skill_id": "CR15", "skill_id": "SK-CR04", "name": "Hypothesis Testing", "description": None},
    {"sub_skill_id": "CR16", "skill_id": "SK-CR04", "name": "Learning from Mistakes", "description": None},
    {"sub_skill_id": "CR17", "skill_id": "SK-CR04", "name": "Prototyping", "description": None},
    {"sub_skill_id": "CR18", "skill_id": "SK-CR05", "name": "Conceptual Mapping", "description": None},
    {"sub_skill_id": "CR19", "skill_id": "SK-CR05", "name": "Cross-Disciplinary Thinking", "description": None},
    {"sub_skill_id": "CR20", "skill_id": "SK-CR05", "name": "Unconventional Exploration", "description": None},
    {"sub_skill_id": "CR21", "skill_id": "SK-CR06", "name": "Alternative Thinking", "description": None},
    {"sub_skill_id": "CR22", "skill_id": "SK-CR06", "name": "Idea Generation", "description": None},
    {"sub_skill_id": "CR23", "skill_id": "SK-CR06", "name": "Practicing Narrative Thinking", "description": None},
    {"sub_skill_id": "CR24", "skill_id": "SK-CR06", "name": "Sensory Imagination", "description": None},
    {"sub_skill_id": "CR25", "skill_id": "SK-CR06", "name": "Speculative Thinking", "description": None},
    {"sub_skill_id": "CR26", "skill_id": "SK-CR06", "name": "World-Building", "description": None},
    {"sub_skill_id": "CR27", "skill_id": "SK-CR07", "name": "Divergent Thinking", "description": None},
    {"sub_skill_id": "CR28", "skill_id": "SK-CR07", "name": "Non-linear Problem Solving", "description": None},
    {"sub_skill_id": "CR29", "skill_id": "SK-CR07", "name": "Unconventional Approaches", "description": None},

    # Emotional (EM01 - EM13)
    {"sub_skill_id": "EM01", "skill_id": "SK-EM01", "name": "Mental Clarity", "description": None},
    {"sub_skill_id": "EM02", "skill_id": "SK-EM01", "name": "Present Moment Awareness", "description": None},
    {"sub_skill_id": "EM03", "skill_id": "SK-EM02", "name": "Celebrating Achievements", "description": None},
    {"sub_skill_id": "EM04", "skill_id": "SK-EM02", "name": "Recognition of Effort", "description": None},
    {"sub_skill_id": "EM05", "skill_id": "SK-EM03", "name": "Recognizing Emotions", "description": None},
    {"sub_skill_id": "EM06", "skill_id": "SK-EM03", "name": "Reflecting on Personal Experiences", "description": None},
    {"sub_skill_id": "EM07", "skill_id": "SK-EM03", "name": "Understanding Triggers", "description": None},
    {"sub_skill_id": "EM08", "skill_id": "SK-EM04", "name": "Intrinsic Motivation", "description": None},
    {"sub_skill_id": "EM09", "skill_id": "SK-EM04", "name": "Maintaining Focus", "description": None},
    {"sub_skill_id": "EM10", "skill_id": "SK-EM04", "name": "Overcoming Obstacles", "description": None},
    {"sub_skill_id": "EM11", "skill_id": "SK-EM05", "name": "Controlling Impulses", "description": None},
    {"sub_skill_id": "EM12", "skill_id": "SK-EM05", "name": "Goal-Oriented Behavior", "description": None},
    {"sub_skill_id": "EM13", "skill_id": "SK-EM05", "name": "Managing Stress", "description": None},

    # Environmental (EN01 - EN11)
    {"sub_skill_id": "EN01", "skill_id": "SK-EN01", "name": "Biodiversity and Conservation", "description": None},
    {"sub_skill_id": "EN02", "skill_id": "SK-EN01", "name": "Environmental Impact", "description": None},
    {"sub_skill_id": "EN03", "skill_id": "SK-EN01", "name": "Environmental Policy & Ethics", "description": None},
    {"sub_skill_id": "EN04", "skill_id": "SK-EN01", "name": "Interconnected Ecology", "description": None},
    {"sub_skill_id": "EN05", "skill_id": "SK-EN01", "name": "Sustainable Resource Management", "description": None},
    {"sub_skill_id": "EN06", "skill_id": "SK-EN01", "name": "Understanding Ecosystems", "description": None},
    {"sub_skill_id": "EN07", "skill_id": "SK-EN02", "name": "Climate and Habitat Changes", "description": None},
    {"sub_skill_id": "EN08", "skill_id": "SK-EN02", "name": "Geospatial Mapping", "description": None},
    {"sub_skill_id": "EN09", "skill_id": "SK-EN02", "name": "Indigenous Spatial Knowledge", "description": None},
    {"sub_skill_id": "EN10", "skill_id": "SK-EN02", "name": "Natural Resource Distribution", "description": None},
    {"sub_skill_id": "EN11", "skill_id": "SK-EN02", "name": "Urbanization and Land Use", "description": None},

    # Social (SO01 - SO20)
    {"sub_skill_id": "SO01", "skill_id": "SK-SO01", "name": "Role Distribution", "description": None},
    {"sub_skill_id": "SO02", "skill_id": "SK-SO01", "name": "Shared Goal Setting", "description": None},
    {"sub_skill_id": "SO03", "skill_id": "SK-SO01", "name": "Teamwork Strategies", "description": None},
    {"sub_skill_id": "SO04", "skill_id": "SK-SO02", "name": "Mediation Techniques", "description": None},
    {"sub_skill_id": "SO05", "skill_id": "SK-SO02", "name": "Negotiation Skills", "description": None},
    {"sub_skill_id": "SO06", "skill_id": "SK-SO02", "name": "Win-Win Solutions", "description": None},
    {"sub_skill_id": "SO07", "skill_id": "SK-SO03", "name": "Constructive Criticism", "description": None},
    {"sub_skill_id": "SO08", "skill_id": "SK-SO03", "name": "Growth-Oriented Feedback", "description": None},
    {"sub_skill_id": "SO09", "skill_id": "SK-SO04", "name": "Emotional Sensitivity", "description": None},
    {"sub_skill_id": "SO10", "skill_id": "SK-SO04", "name": "Perspective-Taking", "description": None},
    {"sub_skill_id": "SO11", "skill_id": "SK-SO04", "name": "Understanding Others' Emotions", "description": None},
    {"sub_skill_id": "SO12", "skill_id": "SK-SO05", "name": "Consensus Building", "description": None},
    {"sub_skill_id": "SO13", "skill_id": "SK-SO05", "name": "Team Behavior", "description": None},
    {"sub_skill_id": "SO14", "skill_id": "SK-SO05", "name": "Understanding Team Roles", "description": None},
    {"sub_skill_id": "SO15", "skill_id": "SK-SO06", "name": "Leading by Example", "description": None},
    {"sub_skill_id": "SO16", "skill_id": "SK-SO06", "name": "Leadership Styles", "description": None},
    {"sub_skill_id": "SO17", "skill_id": "SK-SO06", "name": "Setting Roles for Team", "description": None},
    {"sub_skill_id": "SO18", "skill_id": "SK-SO07", "name": "Accountability", "description": None},
    {"sub_skill_id": "SO19", "skill_id": "SK-SO07", "name": "Consistency in Actions", "description": None},
    {"sub_skill_id": "SO20", "skill_id": "SK-SO07", "name": "Reliability", "description": None},
]
