import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFoodSocket } from '@/hooks/use-socket';
import { useFoodList, useFoodDetail } from '@/hooks/use-queries';
import { api } from '@/lib/api';
import { toast } from 'sonner';

import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Star, Send, Wifi, WifiOff, LogOut, Loader2, Sparkles, Dna } from "lucide-react";
import type { FoodListItem } from '@/lib/types';

const MOOD_LIST = ['happy', 'stressed', 'tired', 'celebratory'] as const;

const AvailabilityBadge = ({ isAvailable }: { isAvailable: boolean }) => {
  return (
    <span className={`font-medium text-xs ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
      {isAvailable ? 'Available Now' : 'Not Available'}
    </span>
  );
};

export default function FoodFeed() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: userProfile } = useQuery({ 
    queryKey: ['user', 'me'], 
    queryFn: api.auth.me,
    select: (res) => res.data
  });
  
  const { 
    data, 
    isLoading: loadingList, 
    isError: isListError, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useFoodList();

  const foodList = data?.pages.flatMap((page) => page.data.items as FoodListItem[]) || [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  useEffect(() => {
    if (!selectedId && foodList.length > 0 && !loadingList) {
      setSelectedId(foodList[0].id);
    }
  }, [foodList, selectedId, loadingList]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastFoodElementRef = useCallback((node: HTMLDivElement) => {
    if (loadingList || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loadingList, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const { data: foodDetail, isLoading: loadingDetail } = useFoodDetail(selectedId);
  const [commentInput, setCommentInput] = useState("");
  const [realtimeRating, setRealtimeRating] = useState<number | null>(null);

  useEffect(() => {
    setRealtimeRating(null);
  }, [selectedId]);

  const socketCallbacks = useMemo(() => ({
    onNewRating: (newAvg: number) => {
      setRealtimeRating(newAvg);
      queryClient.invalidateQueries({ queryKey: ['food', selectedId] });
    }
  }), [selectedId, queryClient]);

  const { isConnected, liveComments, sendMessage } = useFoodSocket(
    selectedId,
    userProfile?.id, 
    socketCallbacks
  );

  const displayRating = realtimeRating ?? foodDetail?.averageRating ?? 0.0;

  const [isLotteryOpen, setIsLotteryOpen] = useState(false);
  const [lotteryState, setLotteryState] = useState<'idle' | 'spinning' | 'won'>('idle');
  const [lotteryText, setLotteryText] = useState("Spinning...");
  const [suggestionResult, setSuggestionResult] = useState<FoodListItem | null>(null);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      toast.info("Logged out successfully");
      navigate("/login"); 
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const handleRate = (rating: number) => {
    if (!selectedId) return;
    sendMessage({ type: 'rate_food', payload: { foodId: selectedId, rating } });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !commentInput.trim()) return;
    sendMessage({ type: 'submit_comment', payload: { foodId: selectedId, content: commentInput } });
    setCommentInput("");
  };

  const handleMoodSelect = async (mood: string) => {
    setLotteryState('spinning');
    
    const fillerNames = foodList.length > 0 
      ? foodList.map(f => f.name) 
      : ["Burger", "Sushi", "Pasta", "Salad", "Tacos", "Pizza"];
    
    const interval = setInterval(() => {
      const randomName = fillerNames[Math.floor(Math.random() * fillerNames.length)];
      setLotteryText(randomName);
    }, 100);

    try {
      const [response] = await Promise.all([
        api.foods.suggest(mood),
        new Promise(resolve => setTimeout(resolve, 1500))
      ]);

      clearInterval(interval);
      if (response && response.data) {
        setSuggestionResult(response.data);
        setLotteryState('won');
      }
    } catch (e) {
      clearInterval(interval);
      setLotteryState('idle');
      toast.error("The AI couldn't decide! Try again.");
    }
  };

  const handleViewSuggestion = () => {
    if (suggestionResult) {
      setSelectedId(suggestionResult.id);
      setIsLotteryOpen(false);
      setLotteryState('idle');
    }
  };

  const displayComments = [
    ...liveComments, 
    ...(foodDetail?.comments || [])
  ].filter((v,i,a)=>a.findIndex(v2=>(v2.id===v.id))===i);

  if (isListError) {
    return <div className="p-10 text-center text-red-500">Failed to load menu. Please try logging in again.</div>;
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      
      {/* --- Header --- */}
      <div className="flex justify-between items-center p-4 sm:p-6 border-b bg-white shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">SuggestMe 2.0</h1>
          
          <Button 
            onClick={() => setIsLotteryOpen(true)}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 hover:from-indigo-600 hover:to-purple-700 shadow-sm gap-2"
            size="sm"
          >
            <Sparkles size={16} /> 
            <span className="hidden sm:inline">Suggest Food</span>
          </Button>
        </div>

        <Button variant="outline" onClick={handleLogout} className="gap-2 h-9 text-sm px-3">
          <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>

      {/* --- Main Content --- */}
      <div className="flex flex-1 flex-col sm:flex-row min-h-0 max-w-7xl mx-auto w-full p-2 sm:p-4 gap-4">
        
        {/* LEFT: Food List */}
        <div className="w-full sm:w-1/3 sm:min-w-[260px] sm:max-w-sm flex flex-col bg-white rounded-lg border shadow-sm shrink-0">
            <div className="p-3 sm:p-4 border-b shrink-0 bg-slate-50/50">
                <h2 className="text-base sm:text-lg font-semibold text-slate-700">Menu</h2>
            </div>
            
            <ScrollArea className="flex-1 h-48 sm:h-auto">
                <div className="p-2 sm:p-3 space-y-2 sm:space-y-3 pb-4">
                    {loadingList && foodList.length === 0 ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
                    ) : (
                      <>
                        {foodList.map((food, index) => {
                          const isLastElement = index === foodList.length - 1;
                          const isSelected = selectedId === food.id;
                          
                          return (
                            <div 
                              key={food.id}
                              ref={isLastElement ? lastFoodElementRef : null}
                            >
                              <Card 
                                  className={`
                                    cursor-pointer transition-all duration-200 border 
                                    ${isSelected 
                                        ? 'border-primary bg-primary/5 shadow-md' 
                                        : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                                    }
                                  `}
                                  onClick={() => setSelectedId(food.id)}
                              >
                                  <CardHeader className="p-3">
                                      <div className="flex flex-wrap justify-between items-start gap-2">
                                          <CardTitle className="text-sm font-medium leading-tight break-words">{food.name}</CardTitle>
                                          <Badge variant={isSelected ? "default" : "secondary"} className="uppercase text-[10px] shrink-0">
                                              {food.mood}
                                          </Badge>
                                      </div>
                                      <CardDescription className="text-xs mt-1">
                                          <AvailabilityBadge isAvailable={food.isAvailable} />
                                      </CardDescription>
                                  </CardHeader>
                              </Card>
                            </div>
                          );
                        })}
                        
                        {isFetchingNextPage && (
                          <div className="flex justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        
                        {!hasNextPage && foodList.length > 0 && (
                          <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground py-2">
                            End of Menu
                          </p>
                        )}
                      </>
                    )}
                </div>
            </ScrollArea>
        </div>

        {/* RIGHT: Detail View */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-lg border shadow-sm bg-white">
            {selectedId ? (
            <div className="flex flex-col h-full">
                <CardHeader className="border-b p-4 sm:p-6 space-y-4 shrink-0 bg-white z-10">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap justify-between items-start gap-3">
                            <div className="min-w-0 flex-1">
                                {foodDetail ? (
                                    <>
                                        <CardTitle className="text-xl sm:text-2xl md:text-3xl break-words leading-tight">
                                            {foodDetail.name}
                                        </CardTitle>
                                        <CardDescription className="text-sm sm:text-base mt-1 text-slate-600">
                                            Perfect for a <span className="font-semibold text-primary capitalize">{foodDetail.mood}</span> mood.
                                        </CardDescription>
                                    </>
                                ) : (
                                    <div className="h-8 w-32 bg-slate-100 animate-pulse rounded" />
                                )}
                            </div>
                            <Badge variant={isConnected ? "default" : "destructive"} className="gap-1.5 px-2 py-1 shadow-sm shrink-0 h-fit">
                                {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                                <span className="text-[10px] sm:text-xs">{isConnected ? "Live" : "Offline"}</span>
                            </Badge>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between bg-slate-50 p-3 rounded-lg border gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                             <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border shadow-sm">
                                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                <span className="text-base font-bold">{displayRating.toFixed(1) || "0.0"}</span>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                ({foodDetail?.ratings?.length || 0} reviews)
                            </span>
                        </div>

                        <div className="flex gap-1 justify-end shrink-0 flex-wrap">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Button 
                                key={star} 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleRate(star)}
                                className="h-8 w-8 p-0 hover:bg-yellow-50 hover:text-yellow-500 text-slate-300 transition-colors"
                                >
                                    <Star className="fill-current w-4 h-4" />
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardHeader>

                <ScrollArea className="flex-1 bg-slate-50/50">
                    <div className="p-4 sm:p-6 min-h-full">
                        {loadingDetail ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-3xl mx-auto">
                                {displayComments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
                                        <div className="bg-slate-100 p-3 rounded-full">
                                            <span className="text-2xl">💬</span>
                                        </div>
                                        <div>
                                            <p className="text-slate-900 font-medium text-sm">No comments yet</p>
                                            <p className="text-xs text-muted-foreground mt-1">Be the first to say something!</p>
                                        </div>
                                    </div>
                                ) : (
                                    displayComments.map((comment, i) => (
                                        <div key={comment.id || i} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 group">
                                            <Avatar className="h-8 w-8 border-2 border-white shadow-sm shrink-0">
                                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.user.username}`} />
                                                <AvatarFallback className="bg-primary/10 text-primary uppercase font-bold text-[10px]">
                                                    {comment.user.username?.[0] || '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                                                    <span className="font-semibold text-sm text-slate-900 truncate max-w-[150px]">
                                                        {comment.user.username}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 shrink-0">
                                                        {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                                                    </span>
                                                </div>
                                                <div className="bg-white p-3 rounded-2xl rounded-tl-none border shadow-sm text-sm text-slate-700 leading-relaxed break-words">
                                                    {comment.content}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <CardFooter className="p-3 sm:p-4 border-t bg-white shrink-0">
                    <form onSubmit={handleComment} className="flex w-full gap-2 max-w-3xl mx-auto items-center">
                        <Input 
                            value={commentInput} 
                            onChange={(e) => setCommentInput(e.target.value)}
                            placeholder="Type a message..." 
                            disabled={!isConnected}
                            className="flex-1 bg-slate-50 focus:bg-white transition-all border-slate-200 text-sm"
                        />
                        <Button 
                            type="submit" 
                            size="sm"
                            disabled={!isConnected || !commentInput.trim()} 
                            className="shrink-0 gap-2 shadow-sm"
                        >
                            <span className="hidden sm:inline">Send</span> 
                            <Send size={14} />
                        </Button>
                    </form>
                </CardFooter>
            </div>
            ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground bg-slate-100/50 rounded-lg border-2 border-dashed border-slate-200 m-2 p-4 text-center text-sm">
                {loadingList ? <Loader2 className="animate-spin" /> : "Select a food item from the menu to view details"}
            </div>
            )}
        </div>
      </div>

      <Dialog open={isLotteryOpen} onOpenChange={(open) => {
        setIsLotteryOpen(open);
        if (!open) {
          setLotteryState('idle');
          setSuggestionResult(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">What's your mood?</DialogTitle>
            <DialogDescription className="text-center">
              Let our AI pick the perfect meal for you.
            </DialogDescription>
          </DialogHeader>

          {lotteryState === 'idle' && (
            <div className="grid grid-cols-2 gap-3 py-4">
              {MOOD_LIST.map((mood) => (
                <Button 
                  key={mood}
                  variant="outline"
                  className="h-20 text-lg capitalize hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={() => handleMoodSelect(mood)}
                >
                  {mood === 'happy' && '😊'}
                  {mood === 'stressed' && '😫'}
                  {mood === 'tired' && '😴'}
                  {mood === 'celebratory' && '🎉'}
                  <span className="ml-2">{mood}</span>
                </Button>
              ))}
            </div>
          )}

          {lotteryState === 'spinning' && (
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <Dna className="h-12 w-12 text-primary animate-spin" />
              <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse">
                {lotteryText}
              </div>
              <p className="text-sm text-muted-foreground">Consulting the foodie spirits...</p>
            </div>
          )}

          {lotteryState === 'won' && suggestionResult && (
            <div className="py-4 space-y-4">
              <div className="text-center space-y-2">
                <span className="text-4xl animate-bounce block">✨</span>
                <h3 className="text-lg font-medium text-muted-foreground">You should eat...</h3>
                <h2 className="text-3xl font-bold text-slate-800">{suggestionResult.name}</h2>
              </div>
              
              <div className="flex justify-center gap-3 pt-4">
                <Button variant="outline" onClick={() => setLotteryState('idle')}>
                  Try Again
                </Button>
                <Button onClick={handleViewSuggestion}>
                  View Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}