import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Image, // Import Image
  Platform, // Import Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  ChevronDown,
  Trash2,
  GripVertical,
  Image as ImageIcon, // Renamed to avoid conflict with RN Image
} from 'lucide-react-native';
import { useColorScheme, getColors } from '@/hooks/useColorScheme';
import { router, useLocalSearchParams } from 'expo-router';
import { WorkoutTemplate, TemplateExercise } from '@/types/workout';
import { getExercises } from '@/utils/storage';
import { supabase } from '@/lib/supabase';
import BottomSheet from '@/components/BottomSheet';
import * as ImagePicker from 'expo-image-picker'; // Import ImagePicker
import 'react-native-url-polyfill/auto'; // Required for Supabase Storage on React Native
import { decode } from 'base64-arraybuffer'; // For converting base64 to ArrayBuffer

const templateCategories = [
  'Strength',
  'Cardio',
  'Bodyweight',
  'HIIT',
  'Flexibility',
  'Athletic Performance',
  'Rehabilitation',
  'Full Body',
  'Upper Body',
  'Lower Body',
];

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function CreateTemplateScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme as 'light' | 'dark' | null);
  const styles = createStyles(colors);
  const { edit, duplicate } = useLocalSearchParams();

  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('60');
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null); // New state for thumbnail

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!edit;
  const isDuplicating = !!duplicate;

  useEffect(() => {
    loadExercises();
    if (isEditing || isDuplicating) {
      loadTemplate();
    }
  }, [edit, duplicate]);

  const isUUID = (id: string) => typeof id === 'string' && /^[0-9a-fA-F-]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id);

  const loadExercises = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setExercises([]);
        return;
      }
      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (profileError || !profileData) {
        setExercises([]);
        return;
      }
      // Fetch public and user-created exercises
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .or(`is_public.eq.true,created_by.eq.${profileData.id}`);
      if (error) {
        console.error('Error loading exercises from Supabase:', error);
        setExercises([]);
        return;
      }
      setExercises((data || []).filter(ex => isUUID(ex.id)));
    } catch (error) {
      console.error('Error loading exercises:', error);
      setExercises([]);
    }
  };

  const loadTemplate = async () => {
    try {
      const templateId = (edit || duplicate) as string;

      // Fetch template from Supabase
      const { data: templateData, error: templateError } = await supabase
        .from('workout_templates')
        .select(`
          *,
          template_exercises (
            *,
            exercise:exercises (*)
          )
        `)
        .eq('id', templateId)
        .single();

      if (templateError) {
        console.error('Error loading template from database:', templateError);
        Alert.alert('Error', 'Failed to load template');
        return;
      }

      if (templateData) {
        // Transform the data to match the WorkoutTemplate interface
        const template: WorkoutTemplate = {
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
            sets: te.sets_config ? (() => {
              try {
                const parsed = typeof te.sets_config === 'string' ? JSON.parse(te.sets_config) : te.sets_config;
                return Array.isArray(parsed) && parsed.length > 0 ? parsed : [
                  { reps: 10, weight: 0, restTime: 60 },
                  { reps: 10, weight: 0, restTime: 60 },
                  { reps: 10, weight: 0, restTime: 60 },
                ];
              } catch (error) {
                console.error('Error parsing sets_config:', error);
                return [
                  { reps: 10, weight: 0, restTime: 60 },
                  { reps: 10, weight: 0, restTime: 60 },
                  { reps: 10, weight: 0, restTime: 60 },
                ];
              }
            })() : [
              { reps: 10, weight: 0, restTime: 60 },
              { reps: 10, weight: 0, restTime: 60 },
              { reps: 10, weight: 0, restTime: 60 },
            ],
            order: te.order_index,
            notes: te.notes
          })),
          createdBy: templateData.created_by,
          createdAt: templateData.created_at,
          updatedAt: templateData.updated_at,
          isPublic: templateData.is_public,
          image_url: templateData.image_url, // Load image_url
        };

        setTemplateName(isDuplicating ? `${template.name} (Copy)` : template.name);
        setTemplateDescription(template.description || '');
        setSelectedCategory(template.category);
        setEstimatedDuration(template.duration.toString());
        setTemplateExercises(template.exercises);
        setThumbnailImage(template.image_url || null); // Set thumbnail image
      }
    } catch (error) {
      console.error('Error loading template:', error);
      Alert.alert('Error', 'Failed to load template');
    }
  };

  const handleAddExercise = (exercise: Exercise) => {
    const templateExercise: TemplateExercise = {
      id: generateUUID(),
      exerciseId: exercise.id,
      exercise,
      sets: [
        { reps: 10, weight: 0, restTime: 60 },
        { reps: 10, weight: 0, restTime: 60 },
        { reps: 10, weight: 0, restTime: 60 },
      ],
      order: templateExercises.length,
    };

    setTemplateExercises(prev => [...prev, templateExercise]);
    setShowExercisePicker(false);
    setSearchQuery('');
  };

  const handleRemoveExercise = (exerciseId: string) => {
    setTemplateExercises(prev => prev.filter(ex => ex.id !== exerciseId));
  };

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant media library permissions to select an image.');
        return;
      }
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images, // Use MediaType.Images
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setLoading(true);
      try {
        const imageUrl = await uploadImageToSupabase(uri);
        if (imageUrl) {
          setThumbnailImage(imageUrl);
          Alert.alert('Success', 'Image uploaded successfully!');
        } else {
          Alert.alert('Error', 'Failed to upload thumbnail image.');
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        Alert.alert('Error', 'Failed to upload thumbnail image.');
      } finally {
        setLoading(false);
      }
    }
  };

  const uploadImageToSupabase = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const fileExt = uri.split('.').pop();
      const fileName = `${generateUUID()}.${fileExt}`;
      const filePath = `template_thumbnails/${fileName}`; // Folder in your bucket

      // Supabase Storage upload requires ArrayBuffer for React Native
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      await new Promise(resolve => reader.onloadend = resolve);
      const base64 = reader.result?.toString().split(',')[1];

      if (!base64) {
        throw new Error('Failed to convert image to base64');
      }

      const arrayBuffer = decode(base64);

      const { data, error } = await supabase.storage
        .from('thumbnails') // Your Supabase Storage bucket name
        .upload(filePath, arrayBuffer, {
          contentType: blob.type,
          upsert: true,
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image to Supabase:', error);
      throw error;
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (templateExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    // Check all exercises have valid UUIDs
    for (let i = 0; i < templateExercises.length; i++) {
      if (!isUUID(templateExercises[i].exercise.id)) {
        Alert.alert('Error', 'One or more exercises have invalid IDs. Please recreate them.');
        return;
      }
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        setLoading(false);
        return;
      }

      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData) {
        Alert.alert('Error', 'User profile not found');
        setLoading(false);
        return;
      }

      const templateId = isEditing ? (edit as string) : generateUUID();
      // Insert or update workout_templates
      const templateData = {
        id: templateId,
        name: templateName.trim(),
        description: templateDescription.trim() || null,
        category: selectedCategory,
        estimated_duration_minutes: parseInt(estimatedDuration) || 60,
        created_by: profileData.id,
        is_public: false,
        image_url: thumbnailImage, // Save image_url
      };
      let templateResult;
      if (isEditing) {
        const { data, error } = await supabase
          .from('workout_templates')
          .update(templateData)
          .eq('id', templateId)
          .select()
          .single();
        templateResult = { data, error };
      } else {
        const { data, error } = await supabase
          .from('workout_templates')
          .insert(templateData)
          .select()
          .single();
        templateResult = { data, error };
      }
      if (templateResult.error) {
        throw templateResult.error;
      }
      // Remove existing template_exercises if editing
      if (isEditing) {
        await supabase
          .from('template_exercises')
          .delete()
          .eq('template_id', templateId);
      }
      // Insert template_exercises
      for (let i = 0; i < templateExercises.length; i++) {
        const te = templateExercises[i];
        const teData = {
          id: te.id || generateUUID(),
          template_id: templateId,
          exercise_id: te.exercise.id,
          order_index: i,
          sets_config: JSON.stringify(te.sets),
          notes: te.notes || null,
        };
        const { error: teError } = await supabase
          .from('template_exercises')
          .insert(teData);
        if (teError) {
          throw teError;
        }
      }
      Alert.alert(
        'Success',
        `Template ${isEditing ? 'updated' : 'created'} successfully!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const filteredExercises = exercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exercise.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (exercise.muscle_groups || []).some(mg => mg.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderExerciseCard = (templateExercise: TemplateExercise, index: number) => {
    return (
      <View key={templateExercise.id} style={styles.exerciseCard}>
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{templateExercise.exercise.name}</Text>
            <Text style={styles.exerciseCategory}>{templateExercise.exercise.category}</Text>
            <Text style={styles.exerciseMuscles}>
              {(templateExercise.exercise.muscle_groups || []).join(', ')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveExercise(templateExercise.id)}
          >
            <Trash2 size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
        <View style={styles.setsInfo}>
          <Text style={styles.setsText}>
            {templateExercise.sets.length} sets • {templateExercise.sets[0]?.reps || 0} reps each
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Edit Template' : isDuplicating ? 'Duplicate Template' : 'Create Template'}
        </Text>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveTemplate}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Template Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Template Information</Text>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Template Name *</Text>
            <TextInput
              style={styles.textInput}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="Enter template name"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.textArea}
              value={templateDescription}
              onChangeText={setTemplateDescription}
              placeholder="Describe this workout template..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Thumbnail Image Upload */}
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Thumbnail Image</Text>
            <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
              {thumbnailImage ? (
                <Image source={{ uri: thumbnailImage }} style={styles.thumbnailPreview} />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <ImageIcon size={48} color={colors.textTertiary} />
                  <Text style={styles.imagePickerText}>Upload Image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formRow}>
            <View style={styles.formFieldHalf}>
              <Text style={styles.fieldLabel}>Category *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={[
                  styles.pickerText,
                  !selectedCategory && styles.placeholderText
                ]}>
                  {selectedCategory || 'Select category'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formFieldHalf}>
              <Text style={styles.fieldLabel}>Duration (min)</Text>
              <TextInput
                style={styles.textInput}
                value={estimatedDuration}
                onChangeText={setEstimatedDuration}
                placeholder="60"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Exercises */}
        <View style={styles.section}>
          <View style={styles.exercisesHeader}>
            <Text style={styles.sectionTitle}>Exercises ({templateExercises.length})</Text>
            <TouchableOpacity
              style={styles.addExerciseButton}
              onPress={() => setShowExercisePicker(true)}
            >
              <Plus size={16} color={colors.primary} />
              <Text style={styles.addExerciseText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>



          {templateExercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <Text style={styles.emptyExercisesText}>No exercises added yet</Text>
              <TouchableOpacity
                style={styles.addFirstExerciseButton}
                onPress={() => setShowExercisePicker(true)}
              >
                <Text style={styles.addFirstExerciseText}>Add First Exercise</Text>
              </TouchableOpacity>
            </View>
          ) : (
            templateExercises.map(renderExerciseCard)
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.categoryList}>
            {templateCategories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryOption,
                  selectedCategory === category && styles.selectedCategoryOption
                ]}
                onPress={() => {
                  setSelectedCategory(category);
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={[
                  styles.categoryOptionText,
                  selectedCategory === category && styles.selectedCategoryOptionText
                ]}>
                  {category}
                </Text>
                {selectedCategory === category && (
                  <Text style={styles.selectedIndicator}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Exercise Picker Modal */}
      <BottomSheet
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        title="Add Exercise"
        colors={colors}
        snapPoints={[0.7, 0.95]}
      >

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView style={styles.exerciseList}>
          {filteredExercises.length === 0 ? (
            <View style={styles.emptyExerciseList}>
              <Text style={styles.emptyExerciseListText}>
                {searchQuery ? 'No exercises found' : 'No exercises available'}
              </Text>
              <TouchableOpacity
                style={styles.createExerciseButton}
                onPress={() => {
                  setShowExercisePicker(false);
                  router.push('/create-exercise');
                }}
              >
                <Plus size={16} color={colors.primary} />
                <Text style={styles.createExerciseText}>Create New Exercise</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredExercises.map((exercise) => (
              <TouchableOpacity
                key={exercise.id}
                style={styles.exerciseOption}
                onPress={() => handleAddExercise(exercise)}
              >
                <View style={styles.exerciseOptionInfo}>
                  <Text style={styles.exerciseOptionName}>{exercise.name}</Text>
                  <Text style={styles.exerciseOptionCategory}>{exercise.category}</Text>
                  <Text style={styles.exerciseOptionMuscles}>
                    {(exercise.muscle_groups || []).join(', ')}
                  </Text>
                </View>
                <Plus size={20} color={colors.primary} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  backButton: {
    padding: 4,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 16,
  },
  formField: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
  },
  formFieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  textInput: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  textArea: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imagePickerButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePickerPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
  },
  thumbnailPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textTertiary,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addExerciseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.primary,
    marginLeft: 4,
  },
  emptyExercises: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyExercisesText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  addFirstExerciseButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addFirstExerciseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
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
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setsInfo: {
    marginTop: 8,
  },
  setsText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: colors.text,
  },
  categoryList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
  },
  selectedCategoryOption: {
    backgroundColor: `${colors.primary}20`,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  categoryOptionText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: colors.text,
  },
  selectedCategoryOptionText: {
    color: colors.primary,
    fontFamily: 'Inter-SemiBold',
  },
  selectedIndicator: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: colors.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.text,
  },
  exerciseList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyExerciseList: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyExerciseListText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  createExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  createExerciseText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: colors.primary,
    marginLeft: 8,
  },
  exerciseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  exerciseOptionInfo: {
    flex: 1,
  },
  exerciseOptionName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  exerciseOptionCategory: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: colors.primary,
    marginBottom: 2,
  },
  exerciseOptionMuscles: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
});
