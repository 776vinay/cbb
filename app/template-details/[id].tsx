import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Edit,
  Copy,
  Trash2,
  Play,
  Clock,
  Dumbbell,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react-native';
import { useColorScheme, getColors } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import { WorkoutTemplate } from '@/types/workout';
import { formatDuration } from '@/utils/workoutUtils';
import { supabase } from '@/lib/supabase';

export default function TemplateDetailsScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme as 'light' | 'dark' | null);
  const styles = createStyles(colors);
  const { id } = useLocalSearchParams();

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    try {
      if (typeof id === 'string') {
        // Fetch template from database
        const { data: templateData, error: templateError } = await supabase
          .from('workout_templates')
          .select(`
            *,
            template_exercises (
              *,
              exercise:exercises (*)
            )
          `)
          .eq('id', id)
          .single();

        if (templateError) {
          console.error('Error loading template from database:', templateError);
          setTemplate(null);
          return;
        }

        if (!templateData) {
          setTemplate(null);
          return;
        }

        // Transform the data to match the WorkoutTemplate interface
        const transformedTemplate: WorkoutTemplate = {
          id: templateData.id,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          duration: templateData.estimated_duration_minutes || 60,
          exercises: (templateData.template_exercises || []).map((te: any) => ({
            id: te.id,
            exerciseId: te.exercise_id,
            exercise: {
              id: te.exercise?.id || '',
              name: te.exercise?.name || 'Unknown Exercise',
              category: te.exercise?.category || 'Unknown',
              muscleGroups: te.exercise?.muscle_groups || [],
              instructions: te.exercise?.instructions,
              equipment: te.exercise?.equipment
            },
            sets: te.sets_config ? JSON.parse(te.sets_config) : [],
            order: te.order_index,
            notes: te.notes
          })),
          createdBy: templateData.created_by,
          createdAt: templateData.created_at,
          updatedAt: templateData.updated_at,
          isPublic: templateData.is_public,
          image_url: templateData.image_url, // Load image_url
        };

        setTemplate(transformedTemplate);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      Alert.alert('Error', 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (template) {
      router.push(`/create-template?edit=${template.id}`);
    }
  };

  const handleDuplicate = () => {
    if (template) {
      router.push(`/create-template?duplicate=${template.id}`);
    }
  };

  const handleDelete = () => {
    if (!template) return;

    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete template_exercises first (due to foreign key constraint)
              const { error: teError } = await supabase
                .from('template_exercises')
                .delete()
                .eq('template_id', template.id);

              if (teError) {
                throw teError;
              }

              // Delete plan_templates (if they exist)
              const { error: ptError } = await supabase
                .from('plan_templates')
                .delete()
                .eq('template_id', template.id);

              if (ptError) {
                console.error('Error deleting plan templates:', ptError);
                // Don't throw here as this table might not exist
              }

              // Update workout_sessions to remove template reference
              const { error: wsError } = await supabase
                .from('workout_sessions')
                .update({ template_id: null })
                .eq('template_id', template.id);

              if (wsError) {
                console.error('Error updating workout sessions:', wsError);
                // Don't throw here as this table might not exist
              }

              // Update training_sessions to remove template reference
              const { error: tsError } = await supabase
                .from('training_sessions')
                .update({ template_id: null })
                .eq('template_id', template.id);

              if (tsError) {
                console.error('Error updating training sessions:', tsError);
                // Don't throw here as this table might not exist
              }

              // Finally delete the template
              const { error: templateError } = await supabase
                .from('workout_templates')
                .delete()
                .eq('id', template.id);

              if (templateError) {
                throw templateError;
              }

              router.back();
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'Failed to delete template');
            }
          }
        }
      ]
    );
  };

  const handleStartWorkout = () => {
    if (template) {
      router.push(`/start-workout/${template.id}`);
    }
  };

  const getExerciseImage = (exerciseName: string, index: number): string => {
    const images = [
      'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=400',
      'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400',
      'https://images.pexels.com/photos/416778/pexels-photo-416778.jpeg?auto=compress&cs=tinysrgb&w=400',
      'https://images.pexels.com/photos/3822356/pexels-photo-3822356.jpeg?auto=compress&cs=tinysrgb&w=400',
      'https://images.pexels.com/photos/1431282/pexels-photo-1431282.jpeg?auto=compress&cs=tinysrgb&w=400',
      'https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg?auto=compress&cs=tinysrgb&w=400',
    ];
    return images[index % images.length];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading template...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!template) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Template Not Found</Text>
          <Text style={styles.errorText}>The requested template could not be found.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Template Details</Text>
        <TouchableOpacity style={styles.headerButton}>
          <MoreHorizontal size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Template Header */}
        <View style={styles.templateHeader}>
          {template.image_url && (
            <Image source={{ uri: template.image_url }} style={styles.templateImage} />
          )}
          <View style={styles.templateInfo}>
            <Text style={styles.templateName}>{template.name}</Text>
            {template.description && (
              <Text style={styles.templateDescription}>{template.description}</Text>
            )}
            <View style={styles.templateMeta}>
              <View style={styles.metaItem}>
                <Dumbbell size={16} color={colors.textSecondary} />
                <Text style={styles.metaText}>{template.exercises.length} exercises</Text>
              </View>
              <View style={styles.metaItem}>
                <Clock size={16} color={colors.textSecondary} />
                <Text style={styles.metaText}>{formatDuration(template.estimated_duration_minutes)}</Text>
              </View>
            </View>
            <View style={[styles.categoryBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Text style={[styles.categoryText, { color: colors.primary }]}>
                {template.category}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleStartWorkout}>
            <Play size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Start Workout</Text>
          </TouchableOpacity>

          <View style={styles.secondaryButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleEdit}>
              <Edit size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleDuplicate}>
              <Copy size={18} color={colors.success} />
              <Text style={styles.secondaryButtonText}>Duplicate</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleDelete}>
              <Trash2 size={18} color={colors.error} />
              <Text style={styles.secondaryButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Exercises List */}
        <View style={styles.exercisesSection}>
          <Text style={styles.sectionTitle}>Exercises ({template.exercises.length})</Text>

          {template.exercises.map((templateExercise, index) => (
            <View key={templateExercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Image
                  source={{ uri: getExerciseImage(templateExercise.exercise.name, index) }}
                  style={styles.exerciseImage}
                />
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{templateExercise.exercise.name}</Text>
                  <Text style={styles.exerciseCategory}>{templateExercise.exercise.category}</Text>
                  <Text style={styles.exerciseMuscles}>
                    {templateExercise.exercise.muscle_groups?.join(', ') || 'No muscle groups specified'}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textTertiary} />
              </View>

              <View style={styles.exerciseDetails}>
                <Text style={styles.setsTitle}>Sets Configuration:</Text>
                {templateExercise.sets_config.map((set, setIndex) => (
                  <View key={setIndex} style={styles.setRow}>
                    <Text style={styles.setNumber}>Set {setIndex + 1}</Text>
                    <Text style={styles.setDetails}>
                      {set.reps ? `${set.reps} reps` : ''}
                      {set.weight ? ` @ ${set.weight}kg` : ''}
                      {set.duration ? ` ${set.duration}s` : ''}
                      {set.rest_time ? ` • Rest: ${set.rest_time}s` : ''}
                    </Text>
                  </View>
                ))}
              </View>

              {templateExercise.notes && (
                <View style={styles.exerciseNotes}>
                  <Text style={styles.notesTitle}>Notes:</Text>
                  <Text style={styles.notesText}>{templateExercise.notes}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Template Info */}
        <View style={styles.templateInfoSection}>
          <Text style={styles.sectionTitle}>Template Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created by:</Text>
              <Text style={styles.infoValue}>{template.createdBy}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created:</Text>
              <Text style={styles.infoValue}>
                {new Date(template.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last updated:</Text>
              <Text style={styles.infoValue}>
                {new Date(template.updatedAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Visibility:</Text>
              <Text style={styles.infoValue}>
                {template.isPublic ? 'Public' : 'Private'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  templateHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  templateImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    resizeMode: 'cover',
  },
  templateInfo: {
    alignItems: 'flex-start',
  },
  templateName: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: colors.text,
    marginBottom: 8,
  },
  templateDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  categoryBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  actionButtons: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  secondaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.text,
  },
  exercisesSection: {
    padding: 20,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  exerciseCategory: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.primary,
    marginBottom: 2,
  },
  exerciseMuscles: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  exerciseDetails: {
    marginBottom: 12,
  },
  setsTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  setNumber: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.textSecondary,
    minWidth: 50,
  },
  setDetails: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  exerciseNotes: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: 12,
  },
  notesTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: colors.text,
    marginBottom: 4,
  },
  notesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  templateInfoSection: {
    padding: 20,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.text,
  },
});
