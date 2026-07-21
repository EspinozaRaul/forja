import { View, Text, TouchableOpacity } from 'react-native';
import { useState, useEffect, useRef, type RefObject } from 'react';

interface RestTimerProps {
  duration: number; // seconds
  onComplete?: () => void;
  onSkip?: () => void;
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function RestTimer({ duration, onComplete, onSkip }: RestTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [active, setActive] = useState(false);
  const intervalRef: RefObject<ReturnType<typeof setInterval> | null> = useRef(null);

  useEffect(() => {
    if (active && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setActive(false);
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [active, remaining, onComplete]);

  const handleStart = () => {
    setRemaining(duration);
    setActive(true);
  };

  const handleSkip = () => {
    setActive(false);
    setRemaining(0);
    onSkip?.();
  };

  const progress = duration > 0 ? remaining / duration : 0;

  return (
    <View className="items-center py-4">
      <View className="relative w-32 h-32 items-center justify-center mb-4">
        {/* Background circle */}
        <View className="absolute w-32 h-32 rounded-full border-4 border-gray-200" />
        {/* Progress indicator via border color change */}
        <Text className="text-3xl font-mono font-bold text-gray-900">
          {formatCountdown(remaining)}
        </Text>
      </View>

      <View className="flex-row gap-3">
        {!active && remaining === 0 ? (
          <TouchableOpacity
            onPress={handleStart}
            className="bg-blue-500 rounded-lg px-6 py-3"
          >
            <Text className="text-white font-semibold">Start Rest</Text>
          </TouchableOpacity>
        ) : (
          <>
            {active && (
              <TouchableOpacity
                onPress={handleSkip}
                className="bg-gray-200 rounded-lg px-6 py-3"
              >
                <Text className="text-gray-700 font-semibold">Skip</Text>
              </TouchableOpacity>
            )}
            {!active && remaining > 0 && (
              <TouchableOpacity
                onPress={handleStart}
                className="bg-blue-500 rounded-lg px-6 py-3"
              >
                <Text className="text-white font-semibold">Resume</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}
