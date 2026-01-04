import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { InteractionManager } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsTV } from '../../contexts/TVContext';
import { Focusable } from '../tv/Focusable';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 7; // 7 days in a week
const DAY_ITEM_SIZE = (width - 32 - 56) / 7; // Slightly smaller than 1/7 to fit all days
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarEpisode {
  id: string;
  releaseDate: string;
  // Other properties can be included but aren't needed for the calendar
}

interface DayItemProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasEvents: boolean;
  onPress: (date: Date) => void;
}

interface CalendarSectionProps {
  episodes?: CalendarEpisode[];
  onSelectDate?: (date: Date) => void;
  /** Called when any calendar element receives focus (TV only) */
  onFocus?: () => void;
}

const DayItem = ({ 
  date, 
  isCurrentMonth, 
  isToday: today, 
  isSelected,
  hasEvents, 
  onPress 
}: DayItemProps) => {
  const { currentTheme } = useTheme();
  return (
  <TouchableOpacity 
    style={[
        styles.dayButton, 
      today && styles.todayItem,
      isSelected && styles.selectedItem,
      hasEvents && styles.dayWithEvents
    ]} 
    onPress={() => onPress(date)}
  >
    <Text style={[
      styles.dayText, 
        !isCurrentMonth && { color: currentTheme.colors.lightGray + '80' },
      today && styles.todayText,
      isSelected && styles.selectedDayText
    ]}>
      {date.getDate()}
    </Text>
    {hasEvents && (
        <View style={[styles.eventIndicator, { backgroundColor: currentTheme.colors.primary }]} />
    )}
  </TouchableOpacity>
);
};

export const CalendarSection: React.FC<CalendarSectionProps> = ({
  episodes = [],
  onSelectDate,
  onFocus
}) => {
  const { currentTheme } = useTheme();
  const isTVDevice = useIsTV();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [uiReady, setUiReady] = useState(false);

  // Map of dates with episodes
  const [datesWithEpisodes, setDatesWithEpisodes] = useState<{ [key: string]: boolean }>({});

  // Defer initial heavy work until after interactions
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setUiReady(true));
    return () => task.cancel();
  }, []);

  // Process episodes to identify dates with content (bounded and deferred)
  useEffect(() => {
    if (!uiReady) return;
    const MAX_TO_PROCESS = 3000; // cap to prevent massive loops
    const dateMap: { [key: string]: boolean } = {};
    const len = Math.min(episodes.length, MAX_TO_PROCESS);
    for (let i = 0; i < len; i++) {
      const episode = episodes[i];
      if (episode && episode.releaseDate) {
        const releaseDate = new Date(episode.releaseDate);
        if (!isNaN(releaseDate.getTime())) {
          const dateKey = format(releaseDate, 'yyyy-MM-dd');
          dateMap[dateKey] = true;
        }
      }
    }
    setDatesWithEpisodes(dateMap);
  }, [episodes, uiReady]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    onSelectDate?.(date);
  }, [onSelectDate]);

  const renderDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    // Get the day of the week for the first day (0-6)
    const firstDayOfWeek = start.getDay();

    // Add empty days at the start
    const emptyDays = Array(firstDayOfWeek).fill(null);

    // Calculate remaining days to fill the last row
    const totalDays = emptyDays.length + days.length;
    const remainingDays = 7 - (totalDays % 7);
    const endEmptyDays = remainingDays === 7 ? [] : Array(remainingDays).fill(null);

    const allDays = [...emptyDays, ...days, ...endEmptyDays];
    const weeks = [];

    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7));
    }

    return weeks.map((week, weekIndex) => (
      <View key={weekIndex} style={[styles.weekRow, isTVDevice && styles.weekRowTV]}>
        {week.map((day, dayIndex) => {
          if (!day) {
            return <View key={`empty-${dayIndex}`} style={[styles.emptyDay, isTVDevice && styles.emptyDayTV]} />;
          }

          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasEvents = datesWithEpisodes[format(day, 'yyyy-MM-dd')] || false;

          const dayContent = (focused?: boolean) => (
            <>
              <Text
                style={[
                  styles.dayText,
                  isTVDevice && styles.dayTextTV,
                  { color: currentTheme.colors.text },
                  !isCurrentMonth && { color: currentTheme.colors.lightGray + '80' },
                  isCurrentDay && [styles.todayText, { color: currentTheme.colors.primary }],
                  isSelected && [styles.selectedDayText, { color: currentTheme.colors.text }],
                  focused && { color: currentTheme.colors.primary }
                ]}
              >
                {format(day, 'd')}
              </Text>
              {hasEvents && (
                <View style={[styles.eventDot, { backgroundColor: currentTheme.colors.primary }]} />
              )}
            </>
          );

          if (isTVDevice) {
            return (
              <Focusable
                key={day.toISOString()}
                style={[
                  styles.dayButton,
                  styles.dayButtonTV,
                  isCurrentDay && [styles.todayItem, { backgroundColor: currentTheme.colors.primary + '30', borderColor: currentTheme.colors.primary }],
                  isSelected && [styles.selectedItem, { backgroundColor: currentTheme.colors.primary + '60', borderColor: currentTheme.colors.primary }],
                  hasEvents && styles.dayWithEvents
                ]}
                onPress={() => handleDateSelect(day)}
                onFocus={onFocus}
                borderRadius={24}
                focusScale={1.1}
                showFocusBorder={true}
              >
                {(focused) => dayContent(focused)}
              </Focusable>
            );
          }

          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={[
                styles.dayButton,
                isCurrentDay && [styles.todayItem, { backgroundColor: currentTheme.colors.primary + '30', borderColor: currentTheme.colors.primary }],
                isSelected && [styles.selectedItem, { backgroundColor: currentTheme.colors.primary + '60', borderColor: currentTheme.colors.primary }],
                hasEvents && styles.dayWithEvents
              ]}
              onPress={() => handleDateSelect(day)}
            >
              {dayContent()}
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.darkBackground }]}>
      <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }, isTVDevice && styles.headerTV]}>
        {isTVDevice ? (
          <Focusable
            onPress={goToPreviousMonth}
            onFocus={onFocus}
            style={styles.headerButton}
            borderRadius={20}
            focusScale={1.1}
            showFocusBorder={true}
          >
            {(focused) => (
              <MaterialIcons name="chevron-left" size={28} color={focused ? currentTheme.colors.primary : currentTheme.colors.text} />
            )}
          </Focusable>
        ) : (
          <TouchableOpacity
            onPress={goToPreviousMonth}
            style={styles.headerButton}
          >
            <MaterialIcons name="chevron-left" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
        )}

        <Text style={[styles.headerTitle, { color: currentTheme.colors.text }, isTVDevice && styles.headerTitleTV]}>
          {format(currentDate, 'MMMM yyyy')}
        </Text>

        {isTVDevice ? (
          <Focusable
            onPress={goToNextMonth}
            onFocus={onFocus}
            style={styles.headerButton}
            borderRadius={20}
            focusScale={1.1}
            showFocusBorder={true}
          >
            {(focused) => (
              <MaterialIcons name="chevron-right" size={28} color={focused ? currentTheme.colors.primary : currentTheme.colors.text} />
            )}
          </Focusable>
        ) : (
          <TouchableOpacity
            onPress={goToNextMonth}
            style={styles.headerButton}
          >
            <MaterialIcons name="chevron-right" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.weekDaysContainer}>
        {weekDays.map((day, index) => (
          <Text 
            key={index} 
            style={[styles.weekDayText, { color: currentTheme.colors.lightGray }]}
          >
            {day}
          </Text>
        ))}
      </View>
      
      {uiReady ? (
        <View style={styles.daysContainer}>
          {renderDays()}
        </View>
      ) : (
        <View style={styles.daysContainer} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
  },
  weekDayText: {
    fontSize: 12,
  },
  daysContainer: {
    padding: 8,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayText: {
    fontSize: 14,
  },
  emptyDay: {
    width: 36,
    height: 36,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 6,
  },
  todayItem: {
    borderWidth: 1,
  },
  selectedItem: {
    borderWidth: 1,
  },
  todayText: {
    fontWeight: 'bold',
  },
  selectedDayText: {
    fontWeight: 'bold',
  },
  dayWithEvents: {
    position: 'relative',
  },
  eventIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // TV-specific styles
  headerTV: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerTitleTV: {
    fontSize: 20,
  },
  weekRowTV: {
    marginBottom: 12,
  },
  dayButtonTV: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  dayTextTV: {
    fontSize: 16,
  },
  emptyDayTV: {
    width: 48,
    height: 48,
  },
}); 