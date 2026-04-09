export interface RawArticle {
  title: string;
  description: string;
  link: string;
  pubDate?: string;
}

export interface AiSelectedItem {
  newsTitle: string;
  genreKeyword: string;
  reason: string;
  shareText: string;
}

export interface FanzaProduct {
  title: string;
  thumbnailUrl: string;
  affiliateUrlSingle: string;
  affiliateUrlMonthly: string;
  isFallback: boolean;
}

export interface DailyItem {
  id: number;
  newsTitle: string;
  genre: string;
  reason: string;
  shareText: string;
  product: FanzaProduct;
}

export interface DailyData {
  date: string;
  items: DailyItem[];
}
