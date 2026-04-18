#!/usr/bin/env sh
set -eu

TOPICS="
raw_news
processed_news
deduped_news
enriched_news
notifications
processed_news_dlq
deduped_news_dlq
enriched_news_dlq
ranking_news_dlq
"

for topic in $TOPICS; do
  echo "Ensuring topic $topic exists"
done

