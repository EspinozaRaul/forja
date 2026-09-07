import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useBodyMeasurements, useCreateMeasurement, useDeleteMeasurement } from '../../lib/hooks/useBodyMeasurements';
import { useProgressPhotos, useCreatePhoto, useDeletePhoto, usePickPhoto, useTakePhoto } from '../../lib/hooks/useProgressPhotos';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../lib/theme/tokens';
import { THUMBNAIL } from '../../lib/constants/layout';

// ─── Types ──────────────────────────────────────────────

type MeasurementField = 'weight' | 'bodyFat' | 'chest' | 'waist' | 'hips' | 'arms' | 'thighs';

interface MeasurementFieldConfig {
  key: MeasurementField;
  labelKey: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// ─── Constants ──────────────────────────────────────────

const MEASUREMENT_FIELDS: MeasurementFieldConfig[] = [
  { key: 'weight', labelKey: 'progress.measurements.weight', unit: 'kg', icon: 'scale' },
  { key: 'bodyFat', labelKey: 'progress.measurements.bodyFat', unit: '%', icon: 'water' },
  { key: 'chest', labelKey: 'progress.measurements.chest', unit: 'cm', icon: 'body' },
  { key: 'waist', labelKey: 'progress.measurements.waist', unit: 'cm', icon: 'resize' },
  { key: 'hips', labelKey: 'progress.measurements.hips', unit: 'cm', icon: 'ellipse' },
  { key: 'arms', labelKey: 'progress.measurements.arms', unit: 'cm', icon: 'barbell' },
  { key: 'thighs', labelKey: 'progress.measurements.thighs', unit: 'cm', icon: 'footsteps' },
];

const BODY_PART_KEYS = ['front', 'side', 'back'] as const;

// ─── Measurement Input Component ────────────────────────

function MeasurementInput({
  field,
  value,
  onChange,
  label,
}: {
  field: MeasurementFieldConfig;
  value: string;
  onChange: (text: string) => void;
  label: string;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bg.elevated,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: borderWidths.thin,
      borderColor: colors.border.primary,
    }}>
      <Ionicons name={field.icon} size={20} color={colors.accent.primary} />
      <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.primary, width: 70 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="—"
        placeholderTextColor={colors.text.muted}
        keyboardType="decimal-pad"
        style={{
          flex: 1,
          fontSize: fontSizes.md,
          fontFamily: fonts.body,
          color: colors.text.primary,
          textAlign: 'right',
        }}
      />
      <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.muted, width: 30 }}>
        {field.unit}
      </Text>
    </View>
  );
}

// ─── Measurement Delta Component ────────────────────────

function MeasurementDelta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null;
  
  const delta = current - previous;
  if (delta === 0) return null;
  
  const isPositive = delta > 0;
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
      <Ionicons 
        name={isPositive ? 'trending-up' : 'trending-down'} 
        size={10} 
        color={isPositive ? colors.success : colors.error} 
      />
      <Text style={{ 
        fontSize: fontSizes.xs, 
        fontFamily: fonts.bodyMedium, 
        color: isPositive ? colors.success : colors.error 
      }}>
        {isPositive ? '+' : ''}{delta.toFixed(1)}
      </Text>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────

export default function MeasurementsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  
  const { data: measurements, isLoading: measurementsLoading } = useBodyMeasurements();
  const { data: photos, isLoading: photosLoading } = useProgressPhotos();
  const createMeasurement = useCreateMeasurement();
  const deleteMeasurement = useDeleteMeasurement();
  const createPhoto = useCreatePhoto();
  const deletePhoto = useDeletePhoto();
  const pickPhoto = usePickPhoto();
  const takePhoto = useTakePhoto();
  
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<Record<MeasurementField, string>>({
    weight: '',
    bodyFat: '',
    chest: '',
    waist: '',
    hips: '',
    arms: '',
    thighs: '',
  });
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>('front');
  
  const isLoading = measurementsLoading || photosLoading;
  
  // Calculate deltas for the most recent measurement
  const latestMeasurement = measurements?.[0];
  const previousMeasurement = measurements?.[1];
  
  const handleSave = async () => {
    const hasValues = Object.values(formValues).some((v) => v !== '');
    if (!hasValues) {
      Alert.alert(t('common.error'), t('progress.measurements.errorEmpty'));
      return;
    }
    
    await createMeasurement.mutateAsync({
      date: new Date(),
      weight: formValues.weight ? parseFloat(formValues.weight) : undefined,
      bodyFat: formValues.bodyFat ? parseFloat(formValues.bodyFat) : undefined,
      chest: formValues.chest ? parseFloat(formValues.chest) : undefined,
      waist: formValues.waist ? parseFloat(formValues.waist) : undefined,
      hips: formValues.hips ? parseFloat(formValues.hips) : undefined,
      arms: formValues.arms ? parseFloat(formValues.arms) : undefined,
      thighs: formValues.thighs ? parseFloat(formValues.thighs) : undefined,
    });
    
    setFormValues({
      weight: '',
      bodyFat: '',
      chest: '',
      waist: '',
      hips: '',
      arms: '',
      thighs: '',
    });
    setShowForm(false);
  };
  
  const handleAddPhoto = async (type: 'pick' | 'take') => {
    const result = type === 'pick' ? await pickPhoto(selectedBodyPart) : await takePhoto(selectedBodyPart);
    
    if (result) {
      await createPhoto.mutateAsync({
        date: new Date(),
        uri: result.uri,
        bodyPart: result.bodyPart,
      });
    }
  };
  
  const handleDeleteMeasurement = (id: number) => {
    Alert.alert(
      t('progress.measurements.deleteMeasurement'),
      t('progress.measurements.deleteMeasurementConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteMeasurement.mutateAsync(id) },
      ]
    );
  };
  
  const handleDeletePhoto = (id: number) => {
    Alert.alert(
      t('progress.measurements.deletePhoto'),
      t('progress.measurements.deletePhotoConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deletePhoto.mutateAsync(id) },
      ]
    );
  };
  
  if (isLoading) {
    return <LoadingSpinner message={t('common.loading')} />;
  }
  
  // Translate measurement field labels
  const fieldLabels = MEASUREMENT_FIELDS.map((f) => ({
    ...f,
    label: t(f.labelKey),
  }));
  
  // Translate body part labels
  const bodyPartLabels: Record<string, string> = {
    front: t('progress.measurements.front'),
    side: t('progress.measurements.side'),
    back: t('progress.measurements.back'),
  };
  
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxl,
        paddingBottom: spacing.md,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Ionicons name="body" size={24} color={colors.accent.primary} />
          <Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
            {t('progress.measurements.title')}
          </Text>
        </View>
        
        <Pressable
          onPress={() => setShowForm(!showForm)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: showForm ? colors.error : colors.accent.primary,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.full,
          }}
        >
          <Ionicons name={showForm ? 'close' : 'add'} size={16} color={colors.text.primary} />
          <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: colors.text.primary }}>
            {showForm ? t('common.cancel') : t('progress.measurements.new')}
          </Text>
        </Pressable>
      </View>
      
      {/* Measurement Form */}
      {showForm && (
        <View style={{
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: borderWidths.thin,
          borderColor: colors.border.primary,
        }}>
          <Text style={{ 
            fontSize: fontSizes.md, 
            fontFamily: fonts.bodySemiBold, 
            color: colors.text.primary, 
            marginBottom: spacing.md 
          }}>
            {t('progress.measurements.newMeasurement')}
          </Text>
          
          {fieldLabels.map((field) => (
            <MeasurementInput
              key={field.key}
              field={field}
              value={formValues[field.key]}
              onChange={(text) => setFormValues((prev) => ({ ...prev, [field.key]: text }))}
              label={field.label}
            />
          ))}
          
          <Pressable
            onPress={handleSave}
            disabled={createMeasurement.isPending}
            style={{
              backgroundColor: colors.accent.primary,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              alignItems: 'center',
              marginTop: spacing.md,
            }}
          >
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
              {createMeasurement.isPending ? t('common.loading') : t('common.save')}
            </Text>
          </Pressable>
        </View>
      )}
      
      {/* Latest Measurement Summary */}
      {latestMeasurement && (
        <View style={{
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: borderWidths.thin,
          borderColor: colors.border.primary,
        }}>
          <Text style={{ 
            fontSize: fontSizes.md, 
            fontFamily: fonts.bodySemiBold, 
            color: colors.text.primary, 
            marginBottom: spacing.md 
          }}>
            {t('progress.measurements.latestMeasurement')}
          </Text>
          
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {fieldLabels.map((field) => {
              const value = latestMeasurement[field.key];
              const prevValue = previousMeasurement?.[field.key] ?? null;
              
              if (value === null) return null;
              
              return (
                <View 
                  key={field.key}
                  style={{
                    backgroundColor: colors.bg.elevated,
                    borderRadius: borderRadius.sm,
                    padding: spacing.sm,
                    minWidth: 80,
                  }}
                >
                  <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.secondary }}>
                    {field.label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                    <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.display, color: colors.text.primary }}>
                      {value}
                    </Text>
                    <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted }}>
                      {field.unit}
                    </Text>
                  </View>
                  <MeasurementDelta current={value} previous={prevValue} />
                </View>
              );
            })}
          </View>
        </View>
      )}
      
      {/* Photos Section */}
      <View style={{
        backgroundColor: colors.bg.card,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: borderWidths.thin,
        borderColor: colors.border.primary,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text style={{ 
            fontSize: fontSizes.md, 
            fontFamily: fonts.bodySemiBold, 
            color: colors.text.primary 
          }}>
            {t('progress.measurements.progressPhotos')}
          </Text>
        </View>
        
        {/* Body Part Selector */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {BODY_PART_KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => setSelectedBodyPart(key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.full,
                backgroundColor: selectedBodyPart === key ? colors.accent.primary : colors.bg.elevated,
                borderWidth: borderWidths.thin,
                borderColor: selectedBodyPart === key ? colors.accent.primary : colors.border.primary,
              }}
            >
              <Text style={{
                fontSize: fontSizes.sm,
                fontFamily: fonts.bodyMedium,
                color: selectedBodyPart === key ? colors.text.primary : colors.text.secondary,
              }}>
                {bodyPartLabels[key]}
              </Text>
            </Pressable>
          ))}
        </View>
        
        {/* Photo Buttons */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <Pressable
            onPress={() => handleAddPhoto('pick')}
            disabled={createPhoto.isPending}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              backgroundColor: colors.bg.elevated,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              borderWidth: borderWidths.thin,
              borderColor: colors.border.primary,
            }}
          >
            <Ionicons name="images" size={20} color={colors.accent.primary} />
            <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: colors.text.primary }}>
              {t('progress.measurements.gallery')}
            </Text>
          </Pressable>
          
          <Pressable
            onPress={() => handleAddPhoto('take')}
            disabled={createPhoto.isPending}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              backgroundColor: colors.bg.elevated,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              borderWidth: borderWidths.thin,
              borderColor: colors.border.primary,
            }}
          >
            <Ionicons name="camera" size={20} color={colors.accent.primary} />
            <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: colors.text.primary }}>
              {t('progress.measurements.camera')}
            </Text>
          </Pressable>
        </View>
        
        {/* Photo Gallery */}
        {photos && photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {photos.map((photo) => (
                <Pressable
                  key={photo.id}
                  onLongPress={() => handleDeletePhoto(photo.id)}
                  style={{
                    width: THUMBNAIL.PHOTO_WIDTH,
                    height: THUMBNAIL.PHOTO_HEIGHT,
                    borderRadius: borderRadius.md,
                    overflow: 'hidden',
                    backgroundColor: colors.bg.elevated,
                  }}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: colors.overlay.default,
                    padding: spacing.xs,
                  }}>
                    <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.primary }}>
                      {(photo.bodyPart && bodyPartLabels[photo.bodyPart]) || photo.bodyPart}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <Ionicons name="image-outline" size={32} color={colors.text.muted} />
            <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.sm }}>
              {t('progress.measurements.noPhotos')}
            </Text>
          </View>
        )}
      </View>
      
      {/* Measurement History */}
      {measurements && measurements.length > 0 && (
        <View style={{
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.xxl,
          borderWidth: borderWidths.thin,
          borderColor: colors.border.primary,
        }}>
          <Text style={{ 
            fontSize: fontSizes.md, 
            fontFamily: fonts.bodySemiBold, 
            color: colors.text.primary, 
            marginBottom: spacing.md 
          }}>
            {t('progress.measurements.history')}
          </Text>
          
          {measurements.map((measurement) => (
            <Pressable
              key={measurement.id}
              onLongPress={() => handleDeleteMeasurement(measurement.id)}
              style={{
                backgroundColor: colors.bg.elevated,
                borderRadius: borderRadius.sm,
                padding: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: colors.text.primary }}>
                  {measurement.date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {fieldLabels.map((field) => {
                  const value = measurement[field.key];
                  if (value === null) return null;
                  
                  return (
                    <Text key={field.key} style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.secondary }}>
                      {field.label}: {value} {field.unit}
                    </Text>
                  );
                })}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
