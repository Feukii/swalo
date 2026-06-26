import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Clock, Smartphone, Check, AlertTriangle } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { sellerTasksApi, SellerTask } from '../lib/api';
import { formatDate } from '../utils/date';

interface RelancesScreenProps {
  navigation: { goBack: () => void };
}

export default function RelancesScreen({ navigation }: RelancesScreenProps) {
  const [tasks, setTasks] = useState<SellerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await sellerTasksApi.getTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      // Hors-ligne ou serveur indisponible : liste vide propre
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('Aucun numéro', "Ce client n'a pas de téléphone enregistré.");
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => undefined);
  };

  const handleDone = async (task: SellerTask) => {
    try {
      await sellerTasksApi.markDone(task.id);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch {
      Alert.alert('Erreur', 'Impossible de marquer la tâche comme faite.');
    }
  };

  const isOverdue = (due?: string) => !!due && new Date(due).getTime() < Date.now();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Relances"
        subtitle="Clients à relancer"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.action} />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.action} />
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Check size={28} color={Colors.success.main} />
            </View>
            <Text style={styles.emptyTitle}>Aucune relance</Text>
            <Text style={styles.emptyText}>Tous les clients sont à jour pour le moment.</Text>
          </View>
        ) : (
          tasks.map(task => {
            const overdue = isOverdue(task.due_date);
            const name = task.customer?.name ?? task.title;
            return (
              <View key={task.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: overdue ? Colors.danger.background : Colors.primary[50] },
                    ]}
                  >
                    {overdue ? (
                      <AlertTriangle size={20} color={Colors.danger.main} />
                    ) : (
                      <Clock size={20} color={Colors.action} />
                    )}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {name}
                    </Text>
                    {task.due_date ? (
                      <Text
                        style={[styles.cardDue, overdue && { color: Colors.danger.main }]}
                        numberOfLines={1}
                      >
                        {overdue ? 'En retard · ' : 'Échéance '}
                        {formatDate(task.due_date)}
                      </Text>
                    ) : null}
                    {task.message ? (
                      <Text style={styles.cardMsg} numberOfLines={2}>
                        {task.message}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
                    onPress={() => handleCall(task.customer?.phone)}
                  >
                    <Smartphone size={16} color={Colors.action} />
                    <Text style={styles.btnGhostText}>Appeler</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.btnDone, pressed && styles.pressed]}
                    onPress={() => handleDone(task)}
                  >
                    <Check size={16} color="#FFFFFF" />
                    <Text style={styles.btnDoneText}>Marquer fait</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 96 },
  center: { paddingVertical: 64, alignItems: 'center' },
  empty: { paddingVertical: 64, alignItems: 'center', gap: Spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textColors.tertiary, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardTop: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardDue: { fontSize: 13, color: Colors.textColors.secondary, fontWeight: '500' },
  cardMsg: { fontSize: 13, color: Colors.textColors.tertiary, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  btnGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary[50],
  },
  btnGhostText: { color: Colors.action, fontWeight: '600', fontSize: 14 },
  btnDone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.success.main,
  },
  btnDoneText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.7 },
});
