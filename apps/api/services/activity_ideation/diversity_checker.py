import string

def _tokenize(text: str) -> set:
    text = text.lower()
    for p in string.punctuation:
        text = text.replace(p, ' ')
    words = text.split()
    # Simple stopword removal
    stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "was", "were", "this", "that", "it", "they", "them", "as", "be", "do", "does", "did", "have", "has", "had", "can", "could", "will", "would", "should", "learners", "students", "children", "will", "activity"}
    return set(w for w in words if w not in stopwords and len(w) > 2)

def calculate_jaccard_similarity(text1: str, text2: str) -> float:
    set1 = _tokenize(text1)
    set2 = _tokenize(text2)
    
    if not set1 and not set2:
        return 1.0
    if not set1 or not set2:
        return 0.0
        
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    
    return intersection / union

class ActivityDiversityChecker:
    def __init__(self, threshold: float = 0.45):
        self.threshold = threshold

    def is_too_similar(self, concept_text: str, existing_texts: list[str]) -> bool:
        """
        Check if the new concept is too similar to any existing concepts.
        """
        for text in existing_texts:
            similarity = calculate_jaccard_similarity(concept_text, text)
            if similarity >= self.threshold:
                return True
        return False
