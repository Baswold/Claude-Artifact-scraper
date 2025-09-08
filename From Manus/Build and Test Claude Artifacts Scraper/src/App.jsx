import { useState, useEffect, useRef } from 'react'
import { Heart, MessageCircle, Share, Play, Pause, Volume2, VolumeX, MoreHorizontal, User, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Card } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import './App.css'

// Mock data for Claude artifacts - this will be replaced with real data
const mockArtifacts = [
  {
    id: 1,
    title: "Interactive Solar System",
    description: "A beautiful 3D solar system simulation with realistic planetary orbits and interactive controls",
    author: "CodeMaster",
    likes: 1247,
    comments: 89,
    shares: 34,
    type: "react",
    content: `<div class="solar-system">
      <div class="sun"></div>
      <div class="planet earth"></div>
      <div class="planet mars"></div>
    </div>`,
    url: "https://claude.ai/public/artifacts/solar-system-123",
    thumbnail: "/api/placeholder/400/600",
    createdAt: "2024-01-15T10:30:00Z",
    isLiked: false,
    isBookmarked: false
  },
  {
    id: 2,
    title: "Animated Data Visualization",
    description: "Dynamic charts showing real-time data with smooth animations and interactive tooltips",
    author: "DataViz Pro",
    likes: 892,
    comments: 56,
    shares: 23,
    type: "html",
    content: `<div class="chart-container">
      <canvas id="dataChart"></canvas>
      <div class="controls">
        <button>Play Animation</button>
      </div>
    </div>`,
    url: "https://claude.ai/public/artifacts/data-viz-456",
    thumbnail: "/api/placeholder/400/600",
    createdAt: "2024-01-14T15:45:00Z",
    isLiked: true,
    isBookmarked: false
  },
  {
    id: 3,
    title: "CSS Art Gallery",
    description: "Pure CSS artwork featuring geometric patterns and smooth hover animations",
    author: "CSSArtist",
    likes: 2156,
    comments: 134,
    shares: 67,
    type: "svg",
    content: `<div class="css-art">
      <div class="geometric-pattern">
        <div class="shape triangle"></div>
        <div class="shape circle"></div>
        <div class="shape square"></div>
      </div>
    </div>`,
    url: "https://claude.ai/public/artifacts/css-art-789",
    thumbnail: "/api/placeholder/400/600",
    createdAt: "2024-01-13T09:20:00Z",
    isLiked: false,
    isBookmarked: true
  },
  {
    id: 4,
    title: "Game of Life Simulator",
    description: "Conway's Game of Life with customizable patterns and speed controls",
    author: "GameDev",
    likes: 743,
    comments: 42,
    shares: 18,
    type: "react",
    content: `<div class="game-of-life">
      <canvas id="gameCanvas"></canvas>
      <div class="controls">
        <button>Start</button>
        <button>Reset</button>
        <input type="range" min="1" max="10" value="5">
      </div>
    </div>`,
    url: "https://claude.ai/public/artifacts/game-life-012",
    thumbnail: "/api/placeholder/400/600",
    createdAt: "2024-01-12T14:10:00Z",
    isLiked: true,
    isBookmarked: false
  },
  {
    id: 5,
    title: "Weather Dashboard",
    description: "Beautiful weather interface with animated icons and 7-day forecast",
    author: "WeatherWiz",
    likes: 1534,
    comments: 78,
    shares: 45,
    type: "html",
    content: `<div class="weather-dashboard">
      <div class="current-weather">
        <div class="temperature">22°C</div>
        <div class="condition">Sunny</div>
        <div class="animated-icon sun"></div>
      </div>
      <div class="forecast">
        <!-- 7-day forecast -->
      </div>
    </div>`,
    url: "https://claude.ai/public/artifacts/weather-345",
    thumbnail: "/api/placeholder/400/600",
    createdAt: "2024-01-11T11:30:00Z",
    isLiked: false,
    isBookmarked: true
  }
];

function ArtifactCard({ artifact, isActive, onLike, onComment, onShare, onBookmark }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const cardRef = useRef(null);

  const handleLike = () => {
    onLike(artifact.id);
  };

  const handleComment = () => {
    onComment(artifact.id);
  };

  const handleShare = () => {
    onShare(artifact.id);
  };

  const handleBookmark = () => {
    onBookmark(artifact.id);
  };

  const openArtifact = () => {
    window.open(artifact.url, '_blank');
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'react': return 'bg-blue-500';
      case 'html': return 'bg-orange-500';
      case 'svg': return 'bg-purple-500';
      case 'mermaid': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`relative w-full h-screen flex-shrink-0 bg-black overflow-hidden ${isActive ? 'z-10' : 'z-0'}`}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-pink-900/20" />
      
      {/* Artifact preview/thumbnail - Full width */}
      <div className="absolute inset-0 flex flex-col">
        {/* Main content area - takes full width and height */}
        <div className="flex-1 relative bg-gradient-to-br from-blue-400/20 via-purple-500/20 to-pink-500/20">
          {/* Large artifact icon/preview */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-8xl font-bold opacity-60">
              {artifact.type === 'react' ? '⚛️' : 
               artifact.type === 'html' ? '🌐' : 
               artifact.type === 'svg' ? '🎨' : '📊'}
            </div>
          </div>
          
          {/* Content overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`${getTypeColor(artifact.type)} text-white border-0`}>
                  {artifact.type.toUpperCase()}
                </Badge>
                <span className="text-xs text-white/60">
                  {new Date(artifact.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <h3 className="text-2xl font-bold mb-2 line-clamp-2">{artifact.title}</h3>
              <p className="text-sm text-white/80 mb-4 line-clamp-3">{artifact.description}</p>
              
              <Button 
                onClick={openArtifact}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                variant="outline"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Artifact
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar with actions */}
      <div className="absolute right-4 bottom-20 flex flex-col items-center space-y-6">
        {/* Profile */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-purple-600 rounded-full flex items-center justify-center mb-2">
            <User className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-medium">{artifact.author}</span>
        </div>

        {/* Like */}
        <div className="flex flex-col items-center">
          <Button
            size="lg"
            variant="ghost"
            className={`w-12 h-12 rounded-full ${artifact.isLiked ? 'text-red-500' : 'text-white'} hover:bg-white/20`}
            onClick={handleLike}
          >
            <Heart className={`w-6 h-6 ${artifact.isLiked ? 'fill-current' : ''}`} />
          </Button>
          <span className="text-white text-xs font-medium">{artifact.likes}</span>
        </div>

        {/* Comment */}
        <div className="flex flex-col items-center">
          <Button
            size="lg"
            variant="ghost"
            className="w-12 h-12 rounded-full text-white hover:bg-white/20"
            onClick={handleComment}
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
          <span className="text-white text-xs font-medium">{artifact.comments}</span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center">
          <Button
            size="lg"
            variant="ghost"
            className="w-12 h-12 rounded-full text-white hover:bg-white/20"
            onClick={handleShare}
          >
            <Share className="w-6 h-6" />
          </Button>
          <span className="text-white text-xs font-medium">{artifact.shares}</span>
        </div>

        {/* More options */}
        <Button
          size="lg"
          variant="ghost"
          className="w-12 h-12 rounded-full text-white hover:bg-white/20"
        >
          <MoreHorizontal className="w-6 h-6" />
        </Button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 left-4 right-20">
        <div className="text-white">
          <h2 className="text-lg font-bold mb-1">{artifact.title}</h2>
          <p className="text-sm text-white/80 mb-2 line-clamp-2">{artifact.description}</p>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">@{artifact.author}</span>
            <span className="text-xs text-white/60">•</span>
            <span className="text-xs text-white/60">
              {new Date(artifact.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [artifacts, setArtifacts] = useState(mockArtifacts);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);

  // Load real artifacts data
  useEffect(() => {
    const loadArtifacts = async () => {
      setIsLoading(true);
      try {
        // Try to load from the scraper output
        const response = await fetch('/feed_data.json');
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setArtifacts(data);
          }
        }
      } catch (error) {
        console.log('Using mock data - scraper data not available yet');
      }
      setIsLoading(false);
    };

    loadArtifacts();
  }, []);

  // Handle scroll for navigation
  useEffect(() => {
    const handleScroll = (e) => {
      if (e.deltaY > 0 && currentIndex < artifacts.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (e.deltaY < 0 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleScroll, { passive: false });
      return () => container.removeEventListener('wheel', handleScroll);
    }
  }, [currentIndex, artifacts.length]);

  // Handle touch gestures for mobile
  useEffect(() => {
    let startY = 0;
    let endY = 0;

    const handleTouchStart = (e) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      endY = e.changedTouches[0].clientY;
      const diff = startY - endY;
      
      if (Math.abs(diff) > 50) { // Minimum swipe distance
        if (diff > 0 && currentIndex < artifacts.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else if (diff < 0 && currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart);
      container.addEventListener('touchend', handleTouchEnd);
      return () => {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [currentIndex, artifacts.length]);

  const handleLike = (artifactId) => {
    setArtifacts(prev => prev.map(artifact => 
      artifact.id === artifactId 
        ? { 
            ...artifact, 
            isLiked: !artifact.isLiked,
            likes: artifact.isLiked ? artifact.likes - 1 : artifact.likes + 1
          }
        : artifact
    ));
  };

  const handleComment = (artifactId) => {
    // In a real app, this would open a comment modal
    console.log('Comment on artifact:', artifactId);
  };

  const handleShare = (artifactId) => {
    const artifact = artifacts.find(a => a.id === artifactId);
    if (artifact && navigator.share) {
      navigator.share({
        title: artifact.title,
        text: artifact.description,
        url: artifact.url
      });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(artifact.url);
    }
  };

  const handleBookmark = (artifactId) => {
    setArtifacts(prev => prev.map(artifact => 
      artifact.id === artifactId 
        ? { ...artifact, isBookmarked: !artifact.isBookmarked }
        : artifact
    ));
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading artifacts...</div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-screen overflow-hidden bg-black relative"
      style={{
        transform: `translateY(-${currentIndex * 100}vh)`,
        transition: 'transform 0.3s ease-out'
      }}
    >
      {artifacts.map((artifact, index) => (
        <ArtifactCard
          key={artifact.id}
          artifact={artifact}
          isActive={index === currentIndex}
          onLike={handleLike}
          onComment={handleComment}
          onShare={handleShare}
          onBookmark={handleBookmark}
        />
      ))}

      {/* Navigation dots */}
      <div className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-50">
        {artifacts.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentIndex ? 'bg-white' : 'bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/50 to-transparent p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold">Claude Artifacts</h1>
          <div className="text-white text-sm">
            {currentIndex + 1} / {artifacts.length}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App

