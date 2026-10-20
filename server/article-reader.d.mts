export function extractReadableArticle(html: string): {
  contentHtml: string;
  paragraphCount: number;
  thumbnail?: string;
  author?: string;
};
export default function articleReader(req: Request): Promise<Response>;

