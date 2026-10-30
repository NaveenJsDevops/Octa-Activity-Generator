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
        "intelligence_id": "int-001",
        "name": "Logical-Mathematical",
        "description": "Logical reasoning, critical thinking, and problem solving",
    },
    {
        "intelligence_id": "int-002",
        "name": "Naturalistic",
        "description": "Understanding living things, ecosystems, and nature",
    },
    {
        "intelligence_id": "int-003",
        "name": "Visual-Spatial",
        "description": "Spatial judgment and the ability to visualize and build",
    },
    {
        "intelligence_id": "int-004",
        "name": "Linguistic",
        "description": "Language skills, reading, and storytelling",
    },
]

DEFAULT_SKILLS: List[Dict[str, Any]] = [
    {
        "skill_id": "sk-001",
        "intelligence_id": "int-001",
        "name": "Logical Reasoning",
        "description": "Ability to reason logically and analyze information",
    },
    {
        "skill_id": "sk-002",
        "intelligence_id": "int-002",
        "name": "Environmental Awareness",
        "description": "Observing and understanding natural ecosystems and conservation",
    },
    {
        "skill_id": "sk-003",
        "intelligence_id": "int-003",
        "name": "Spatial & Creative Design",
        "description": "Designing and building visual or physical models",
    },
    {
        "skill_id": "sk-004",
        "intelligence_id": "int-004",
        "name": "Communication & Inquiry",
        "description": "Expressing ideas and asking thoughtful investigative questions",
    },
]

DEFAULT_SUBSKILLS: List[Dict[str, Any]] = [
    {
        "sub_skill_id": "ssk-001",
        "skill_id": "sk-001",
        "name": "Pattern Recognition",
        "description": "Identifying patterns, sequences, and underlying rules",
    },
    {
        "sub_skill_id": "ssk-002",
        "skill_id": "sk-002",
        "name": "Ecosystem Observation",
        "description": "Cataloging species, habitats, and environmental interactions",
    },
    {
        "sub_skill_id": "ssk-003",
        "skill_id": "sk-003",
        "name": "Model Construction",
        "description": "Constructing physical or conceptual models to solve problems",
    },
    {
        "sub_skill_id": "ssk-004",
        "skill_id": "sk-004",
        "name": "Descriptive Documentation",
        "description": "Documenting observations clearly and effectively",
    },
]
