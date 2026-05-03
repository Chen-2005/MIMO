import re


def segment_text(text: str, max_chars: int = 2500) -> list[str]:
    """Split text into segments at sentence boundaries.

    Strategy:
    1. Split on sentence-ending punctuation (。！？!?.) or newlines
    2. Greedily merge sentences into segments up to max_chars
    3. If a single sentence exceeds max_chars, split on commas/semicolons
    """
    text = text.strip()
    if not text:
        return []

    if len(text) <= max_chars:
        return [text]

    sentences = _split_sentences(text)
    return _merge_into_segments(sentences, max_chars)


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on sentence-ending punctuation or newlines."""
    # Split on sentence-ending punctuation, keeping the delimiter attached
    parts = re.split(r"(?<=[。！？!?.\n])", text)
    return [p.strip() for p in parts if p.strip()]


def _merge_into_segments(sentences: list[str], max_chars: int) -> list[str]:
    """Greedily merge sentences into segments up to max_chars."""
    segments: list[str] = []
    current = ""

    for sentence in sentences:
        if len(sentence) > max_chars:
            # Flush current segment
            if current:
                segments.append(current)
                current = ""
            # Split the long sentence on secondary punctuation
            sub_parts = _split_long_sentence(sentence, max_chars)
            segments.extend(sub_parts)
        elif len(current) + len(sentence) + 1 <= max_chars:
            current = current + sentence if not current else current + sentence
        else:
            if current:
                segments.append(current)
            current = sentence

    if current:
        segments.append(current)

    return segments


def _split_long_sentence(sentence: str, max_chars: int) -> list[str]:
    """Split a sentence that exceeds max_chars on secondary punctuation."""
    # Split on commas, semicolons, colons, dashes
    parts = re.split(r"(?<=[，；：、\-—])", sentence)
    parts = [p.strip() for p in parts if p.strip()]

    if not parts:
        return [sentence[:max_chars]]

    segments: list[str] = []
    current = ""

    for part in parts:
        if len(part) > max_chars:
            if current:
                segments.append(current)
                current = ""
            # Force split by character count as last resort
            for i in range(0, len(part), max_chars):
                segments.append(part[i : i + max_chars])
        elif len(current) + len(part) <= max_chars:
            current += part
        else:
            if current:
                segments.append(current)
            current = part

    if current:
        segments.append(current)

    return segments
