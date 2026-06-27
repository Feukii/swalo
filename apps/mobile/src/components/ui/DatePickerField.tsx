import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Calendar, X, ChevronRight } from '../icons/SimpleIcons';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme-v2';

interface DatePickerFieldProps {
  /** Date sélectionnée au format ISO (YYYY-MM-DD) ou chaîne vide si aucune. */
  value: string;
  /** Renvoie la date choisie au format ISO (YYYY-MM-DD). */
  onChange: (isoDate: string) => void;
  /** Libellé du déclencheur quand aucune date n'est choisie. */
  placeholder?: string;
  /** Bornes optionnelles de sélection. */
  minDate?: Date;
  maxDate?: Date;
}

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const WEEK_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// Conversion Date -> clé ISO locale (YYYY-MM-DD), sans décalage de fuseau.
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse une clé ISO (YYYY-MM-DD) en Date locale (midi pour éviter les soucis de fuseau).
function fromISODate(iso: string): Date | null {
  const [y, m, day] = iso.split('-').map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day, 12, 0, 0, 0);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(date: Date): (Date | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: (Date | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
  for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
  return days;
}

/**
 * Sélecteur de date unique (jour) — moderne, sans dépendance externe.
 * Réutilise la logique de grille calendaire de DateRangePicker mais pour une
 * seule date. Le déclencheur affiche un libellé clair et la valeur formatée.
 */
export default function DatePickerField({
  value,
  onChange,
  placeholder = 'Choisir une date',
  minDate,
  maxDate,
}: DatePickerFieldProps) {
  const selected = value ? fromISODate(value) : null;
  const [showModal, setShowModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(selected ?? new Date());

  const formatLong = (iso: string): string => {
    const d = fromISODate(iso);
    if (!d) return placeholder;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const isDateDisabled = (day: Date): boolean => {
    if (minDate) {
      const min = new Date(minDate);
      min.setHours(0, 0, 0, 0);
      const d = new Date(day);
      d.setHours(0, 0, 0, 0);
      if (d < min) return true;
    }
    if (maxDate) {
      const max = new Date(maxDate);
      max.setHours(0, 0, 0, 0);
      const d = new Date(day);
      d.setHours(0, 0, 0, 0);
      if (d > max) return true;
    }
    return false;
  };

  const handleSelect = (day: Date) => {
    onChange(toISODate(day));
    setShowModal(false);
  };

  const openModal = () => {
    setCurrentMonth(selected ?? new Date());
    setShowModal(true);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, value && styles.triggerFilled]}
        onPress={openModal}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Choisir la date d'échéance"
      >
        <View style={styles.triggerIcon}>
          <Calendar size={18} color={Colors.action} />
        </View>
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]} numberOfLines={1}>
          {value ? formatLong(value) : placeholder}
        </Text>
        <ChevronRight size={18} color={Colors.textColors.tertiary} />
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir une date</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalClose}>
                <X size={20} color={Colors.action} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthNavigation}>
              <TouchableOpacity
                onPress={previousMonth}
                style={styles.navButton}
                activeOpacity={0.7}
              >
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navButton} activeOpacity={0.7}>
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekDaysRow}>
              {WEEK_DAYS.map(day => (
                <View key={day} style={styles.weekDayCell}>
                  <Text style={styles.weekDayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {days.map((day, index) => {
                if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
                const isDisabled = isDateDisabled(day);
                const isSelected = selected ? sameDay(day, selected) : false;
                const isToday = sameDay(day, new Date());
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      isDisabled && styles.dayCellDisabled,
                    ]}
                    onPress={() => !isDisabled && handleSelect(day)}
                    disabled={isDisabled}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        isToday && !isSelected && styles.dayTextToday,
                        isDisabled && styles.dayTextDisabled,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 52,
    ...Shadows.sm,
  },
  triggerFilled: {
    borderColor: Colors.action,
    backgroundColor: Colors.info.background,
  },
  triggerIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  triggerPlaceholder: {
    fontWeight: '500',
    color: Colors.textColors.tertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingBottom: Spacing['2xl'],
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  navButtonText: {
    fontSize: 26,
    lineHeight: 28,
    color: Colors.action,
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  weekDaysRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: Colors.action,
    borderRadius: BorderRadius.sm,
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 15,
    color: Colors.text,
  },
  dayTextSelected: {
    color: Colors.onMarine,
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.action,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: Colors.textColors.disabled,
  },
});
