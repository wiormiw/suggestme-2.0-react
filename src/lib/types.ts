export interface User {
  id: string;
  username: string;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: User;
}

export interface Rating {
  rating: number;
  user: User;
}

// Result from GET /foods (The list)
export interface FoodListItem {
  id: string;
  name: string;
  mood: string;
  isAvailable: boolean;
}

// Result from GET /foods/:id/details (The detailed view)
export interface FoodDetail extends FoodListItem {
  averageRating: number;
  comments: Comment[];
  ratings: Rating[];
}

// WebSocket Payloads (kept the same)
export type WsPayload = 
  | { type: 'subscribe'; payload: { foodId: string } }
  | { type: 'rate_food'; payload: { foodId: string; rating: number } }
  | { type: 'submit_comment'; payload: { foodId: string; content: string } };

export type WsResponse = 
  | { type: 'new_comment'; id: string; foodId: string; content: string; createdAt: string; user: User }
  | { type: 'new_rating'; foodId: string; averageRating: number; totalRatings: number }
  | { type: 'ack'; action: string; status: string; message?: string };