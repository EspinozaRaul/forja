import { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useMostUsedExercises } from '../../lib/hooks/useProgress';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { formatRelativeDate } from '../../lib/utils/format';
import { resolveUnit, formatWeight } from '../../lib/utils/weight-unit';
import { useSettings } from '../../lib/utils/settings';
import { getExerciseName } from '../../lib/utils/exercise-names';
import type { MostUsedExercise } from '../../lib/progress/queries';

export default function ExercisesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const settings = useSettings();
  const unit = settings.data.weightUnit;

  const { data: exercises, isLoading, isError } = useMostUsedExercises(100);
  const [search, setSearch] = useState('');

  const filteredExercises = useMemo(() => {
    if (!exercises) return [];
    if (!search.trim()) return exercises;

    const query = search.toLowerCase().trim();
    return exercises.filter((ex) => ex.name.toLowerCase().includes(query));
  }, [exercises, search]);

  const formatDate = (date: Date) => {
    return formatRelativeDate(date);
  };

  const renderExercise = ({ item }: { item: MostUsedExercise }) => {
    const exerciseUnit = resolveUnit(item.unit, unit);

    return (
      <Pressable
        onPress={() => router.push(`/progress/exercise-detail/${item.exerciseId}`)}
        style={{
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border.primary,
          padding: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {/* Exercise Icon */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: borderRadius.md,
              backgroundColor: colors.accent.muted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="barbell" size={22} color={colors.accent.primary} />
          </View>

          {/* Exercise Info */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: fontSizes.md,
                fontFamily: fonts.bodySemiBold,
                color: colors.text.primary,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {getExerciseName(item.name, i18n.language)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text
                style={{
                  fontSize: fontSizes.xs,
                  fontFamily: fonts.body,
                  color: colors.text.muted,
                }}
              >
                {t('exercises.sessionCount', { count: item.sessionCount })}
              </Text>
              <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>{'·'}</Text>
              <Text
                style={{
                  fontSize: fontSizes.xs,
                  fontFamily: fonts.body,
                  color: colors.text.muted,
                }}
              >
                {t('exercises.setCount', { count: item.setCount })}
              </Text>
            </View>
          </View>

          {/* Max Weight */}
          {item.maxWeight != null && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={{
                  fontSize: fontSizes.sm,
                  fontFamily: fonts.bodySemiBold,
                  color: colors.accent.primary,
                }}
              >
                {formatWeight(item.maxWeight, exerciseUnit)}
              </Text>
              <Text
                style={{
                  fontSize: fontSizes.xs,
                  fontFamily: fonts.body,
                  color: colors.text.muted,
                  marginTop: 2,
                }}
              >
                {t('exercises.maxWeight')}
              </Text>
            </View>
          )}

          {/* Chevron */}
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return <LoadingSpinner message={t('exercises.loading')} />;
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <EmptyState
          icon={<Ionicons name="alert-circle-outline" size={48} color={colors.error} />}
          title={t('exercises.error')}
          message={t('exercises.errorMessage')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.divider,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{ padding: spacing.xs }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </Pressable>
        <Ionicons name="barbell" size={20} color={colors.accent.primary} />
        <Text
          style={{
            flex: 1,
            fontSize: fontSizes.lg,
            fontFamily: fonts.bodySemiBold,
            color: colors.text.primary,
          }}
        >
          {t('exercises.title')}
        </Text>
      </View>

      {/* Search Bar */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.bg.card,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border.primary,
            paddingHorizontal: spacing.sm,
          }}
        >
          <Ionicons name="search" size={18} color={colors.text.muted} />
          <TextInput
            style={{
              flex: 1,
              height: 40,
              marginLeft: spacing.sm,
              fontSize: fontSizes.md,
              fontFamily: fonts.body,
              color: colors.text.primary,
            }}
            placeholder={t('exercises.searchPlaceholder')}
            placeholderTextColor={colors.text.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.text.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Exercise List */}
      {filteredExercises.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="barbell-outline" size={48} color={colors.text.muted} />}
          title={search ? t('exercises.noResults') : t('exercises.empty')}
          message={search ? t('exercises.noResultsMessage') : t('exercises.emptyMessage')}
        />
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.exerciseId.toString()}
          renderItem={renderExercise}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
