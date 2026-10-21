DEFAULT_TOPIC_FAMILIES = [
    {
        "topic_family_id": "tf-001",
        "name": "Space Exploration",
        "description": "Topics related to space, planets, and astronomy",
    },
    {
        "topic_family_id": "tf-animals-wildlife",
        "name": "Animals & Wildlife",
        "description": "Animals, habitats, biodiversity, and wildlife conservation",
    },
    {
        "topic_family_id": "tf-nature-environment",
        "name": "Nature & Environment",
        "description": "Plants, ecosystems, weather, and caring for the environment",
    },
    {
        "topic_family_id": "tf-science-technology",
        "name": "Science & Technology",
        "description": "Science experiments, inventions, engineering, and technology",
    },
    {
        "topic_family_id": "tf-arts-creativity",
        "name": "Arts & Creativity",
        "description": "Visual arts, music, design, storytelling, and creative expression",
    },
    {
        "topic_family_id": "tf-culture-community",
        "name": "Culture & Community",
        "description": "Cultures, traditions, relationships, and the communities around us",
    },
    {
        "topic_family_id": "tf-history-geography",
        "name": "History & Geography",
        "description": "People, places, maps, landmarks, and events from the past",
    },
    {
        "topic_family_id": "tf-health-wellbeing",
        "name": "Health & Wellbeing",
        "description": "Healthy habits, emotions, mindfulness, and personal wellbeing",
    },
    {
        "topic_family_id": "tf-food-nutrition",
        "name": "Food & Nutrition",
        "description": "Food, cooking, nutrition, and how food gets to our tables",
    },
    {
        "topic_family_id": "tf-sports-movement",
        "name": "Sports & Movement",
        "description": "Sports, physical activity, coordination, and teamwork",
    },
    {
        "topic_family_id": "tf-math-logic",
        "name": "Math & Logic",
        "description": "Numbers, patterns, puzzles, and logical problem-solving",
    },
    {
        "topic_family_id": "tf-language-literacy",
        "name": "Language & Literacy",
        "description": "Reading, writing, communication, and learning new languages",
    },
]

TOPIC_FAMILY_NAMES = {
    family["topic_family_id"]: family["name"] for family in DEFAULT_TOPIC_FAMILIES
}
