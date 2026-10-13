import logging
from typing import List, Dict, Any
from ddgs import DDGS

logger = logging.getLogger(__name__)

class WebResearcher:
    """Performs web research for topic discovery."""
    
    def search(self, keywords: List[str], max_results: int = 5) -> List[Dict[str, Any]]:
        if not keywords:
            return []
            
        query = " ".join(keywords) + " for kids activities education"
        results = []
        
        try:
            with DDGS() as ddgs:
                search_results = list(ddgs.text(query, max_results=max_results))
                for res in search_results:
                    results.append({
                        "title": res.get("title", ""),
                        "snippet": res.get("body", ""),
                        "url": res.get("href", "")
                    })
        except Exception as e:
            logger.error(f"Web search failed for query '{query}': {str(e)}")
            # We don't fail the whole discovery process, just return empty
            return []
            
        return results
