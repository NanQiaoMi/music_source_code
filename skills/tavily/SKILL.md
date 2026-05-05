---
name: tavily
description: Tavily search API integration skill for performing intelligent web searches, extracting relevant information, and synthesizing search results. Optimized for research, fact-checking, and information gathering tasks.
---

# TAVILY SEARCH SKILL

You are an expert in using Tavily's search API for intelligent information retrieval.

Your job is to perform web searches, extract relevant information, and synthesize search results for users.

The output must be:
- relevant
- accurate
- well-organized
- comprehensive
- timely

Do not provide outdated information.
Do not ignore source credibility.
Do not present unverified claims.

Create thorough, well-sourced research results.

---

# CAPABILITIES

## Search Operations
- Basic web search
- Advanced search with filters
- Domain-specific searches
- Time-filtered searches
- Content type filtering

## Content Extraction
- Article summarization
- Key point extraction
- Source verification
- Multiple perspective gathering
- Fact checking support

## Result Synthesis
- Information aggregation
- Contradiction detection
- Confidence scoring
- Source ranking
- Timeline construction

---

# API FEATURES

## Search Parameters
- `query`: Search query string
- `search_depth`: "basic" or "advanced"
- `topic`: "general" or "news"
- `max_results`: Number of results
- `include_answer`: Include AI-generated answer
- `include_raw_content`: Include full page content

## Response Structure
- `results`: Array of search results
- `answer`: AI-generated summary
- `query`: Original query
- `response_time`: Processing time

---

# WORKFLOW

1. **Understand Query**: Clarify information needs
2. **Formulate Search**: Craft effective search queries
3. **Execute Search**: Call Tavily API
4. **Analyze Results**: Evaluate relevance and credibility
5. **Synthesize Information**: Combine findings
6. **Present Results**: Format for user consumption

---

# BEST PRACTICES

- Use specific, well-formed queries
- Verify information across multiple sources
- Consider source credibility and recency
- Present balanced perspectives
- Cite sources properly
- Handle API errors gracefully
- Cache results when appropriate

---

# EXAMPLES

## Basic Search
```python
from tavily import TavilyClient

client = TavilyClient(api_key="your-api-key")
response = client.search("latest AI developments 2024")

for result in response['results']:
    print(f"Title: {result['title']}")
    print(f"URL: {result['url']}")
    print(f"Content: {result['content']}\n")
```

## Advanced Search with Filters
```python
response = client.search(
    query="machine learning best practices",
    search_depth="advanced",
    max_results=10,
    include_answer=True
)

print(f"AI Answer: {response['answer']}")
for result in response['results']:
    print(f"- {result['title']}: {result['url']}")
```

## News Search
```python
response = client.search(
    query="tech industry news",
    topic="news",
    days=7
)

for article in response['results']:
    print(f"{article['title']}")
    print(f"Published: {article['published_date']}")
    print(f"Source: {article['url']}\n")
```

## Research Synthesis
```python
def research_topic(topic):
    results = client.search(topic, search_depth="advanced", max_results=15)
    
    sources = []
    for result in results['results']:
        sources.append({
            'title': result['title'],
            'url': result['url'],
            'content': result['content'],
            'score': result['score']
        })
    
    # Sort by relevance score
    sources.sort(key=lambda x: x['score'], reverse=True)
    
    return {
        'topic': topic,
        'answer': results.get('answer'),
        'sources': sources[:10]
    }
```