import { View, Text, TouchableOpacity } from 'react-native';
import { useState, useEffect, useRef, type RefObject } from 'react';

interface TimerProps {
  onTimeUpdate?: (seconds: number) => void;
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function Timer({ onTimeUpdate }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef: RefObject<ReturnType<typeof setInterval> | null> = useRef(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          onTimeUpdate?.(next);
          return next;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [running, onTimeUpdate]);

  const handleStart = () => setRunning(true);
  const handleStop = () => setRunning(false);
  const handleReset = () => {
    setRunning(false);
    setElapsed(0);
    onTimeUpdate?.(0);
  };

  return (
    <View className="items-center py-4">
      <Text className="text-4xl font-mono font-bold text-gray-900 mb-4">
        {formatTime(elapsed)}
      </Text>

      <View className="flex-row gap-3">
        {!running ? (
          <TouchableOpacity
            onPress={handleStart}
            className="bg-green-500 rounded-lg px-6 py-3"
          >
            <Text className="text-white font-semibold">Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleStop}
            className="bg-red-500 rounded-lg px-6 py-3"
          >
            <Text className="text-white font-semibold">Stop</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleReset}
          className="bg-gray-200 rounded-lg px-6 py-3"
        >
          <Text className="text-gray-700 font-semibold">Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
