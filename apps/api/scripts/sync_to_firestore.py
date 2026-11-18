import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

import firebase_admin
from firebase_admin import credentials, firestore

from apps.api.core.config import settings
from apps.api.repositories.firestore import FirestoreRepository

def sync_master_data():
    candidates = [
        os.path.join(settings.DATA_DIR, "firebase-key.json"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/firebase-key.json")),
        os.path.abspath("apps/api/data/firebase-key.json")
    ]
    key_path = next((p for p in candidates if os.path.exists(p)), None)
    if not key_path:
        print(f"Error: Credentials file not found in candidates: {candidates}")
        return False

    print(f"Initializing Firebase Admin with key from {key_path}...")
    cred = credentials.Certificate(key_path)
    try:
        app = firebase_admin.initialize_app(cred)
    except ValueError:
        app = firebase_admin.get_app()

    db = firestore.client()
    repo = FirestoreRepository(settings.DATA_DIR)

    # 1. Topic Families
    topic_families = repo.read_sheet("TopicFamilies")
    print(f"Syncing {len(topic_families)} Topic Families...")
    batch = db.batch()
    count = 0
    for tf in topic_families:
        doc_ref = db.collection("topic_families").document(tf["topic_family_id"])
        batch.set(doc_ref, tf)
        count += 1
        if count % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()

    # 2. Intelligences
    intelligences = repo.read_sheet("Intelligences")
    print(f"Syncing {len(intelligences)} Intelligences...")
    batch = db.batch()
    for intel in intelligences:
        doc_ref = db.collection("intelligences").document(intel["intelligence_id"])
        batch.set(doc_ref, intel)
    batch.commit()

    # 3. Skills
    skills = repo.read_sheet("Skills")
    print(f"Syncing {len(skills)} Skills...")
    batch = db.batch()
    count = 0
    for s in skills:
        doc_ref = db.collection("skills").document(s["skill_id"])
        batch.set(doc_ref, s)
        count += 1
        if count % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()

    # 4. SubSkills
    sub_skills = repo.read_sheet("SubSkills")
    print(f"Syncing {len(sub_skills)} SubSkills...")
    batch = db.batch()
    count = 0
    for ss in sub_skills:
        doc_ref = db.collection("sub_skills").document(ss["sub_skill_id"])
        batch.set(doc_ref, ss)
        count += 1
        if count % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()

    # 5. Activity Types
    activity_types = repo.read_sheet("ActivityTypes")
    print(f"Syncing {len(activity_types)} Activity Types...")
    batch = db.batch()
    for at in activity_types:
        doc_ref = db.collection("activity_types").document(at["activity_type_id"])
        batch.set(doc_ref, at)
    batch.commit()

    # 6. Topics
    topics = repo.read_sheet("Topics")
    if topics:
        print(f"Syncing {len(topics)} Topics...")
        batch = db.batch()
        count = 0
        for t in topics:
            doc_ref = db.collection("topics").document(t["topic_id"])
            batch.set(doc_ref, t)
            count += 1
            if count % 400 == 0:
                batch.commit()
                batch = db.batch()
        batch.commit()

    print("\nSuccessfully synced master data to Cloud Firestore!")
    print(f"- Topic Families: {len(topic_families)}")
    print(f"- Intelligences: {len(intelligences)}")
    print(f"- Skills: {len(skills)}")
    print(f"- SubSkills: {len(sub_skills)}")
    print(f"- Activity Types: {len(activity_types)}")
    if topics:
        print(f"- Topics: {len(topics)}")
    return True

if __name__ == "__main__":
    sync_master_data()
