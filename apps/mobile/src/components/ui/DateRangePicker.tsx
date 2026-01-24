import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Calendar, X } from '../icons/SimpleIcons';
import { Colors, Spacing } from '../../constants/theme-v2';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onDateChange: (startDate: Date | null, endDate: Date | null) => void;
  datesWithData?: string[]; // Format: 'YYYY-MM-DD'
  minDate?: Date;
  maxDate?: Date;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  datesWithData = [],
  minDate,
  maxDate,
}: DateRangePickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const formatDate = (date: Date | null) => {
    if (!date) return 'Sélectionner';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const handleDayPress = (day: Date) => {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      // Start new selection
      setTempStartDate(day);
      setTempEndDate(null);
    } else if (day >= tempStartDate) {
      // Set end date
      setTempEndDate(day);
    } else {
      // Clicked before start date, reset
      setTempStartDate(day);
      setTempEndDate(null);
    }
  };

  const handleApply = () => {
    onDateChange(tempStartDate, tempEndDate);
    setShowModal(false);
  };

  const handleReset = () => {
    setTempStartDate(null);
    setTempEndDate(null);
  };

  const isDateInRange = (day: Date) => {
    if (!tempStartDate) return false;
    if (!tempEndDate) return day.getTime() === tempStartDate.getTime();
    return day >= tempStartDate && day <= tempEndDate;
  };

  const isDateDisabled = (day: Date) => {
    if (minDate && day < minDate) return true;
    if (maxDate && day > maxDate) return true;
    return false;
  };

  const hasData = (day: Date) => {
    return datesWithData.includes(formatDateKey(day));
  };

  const monthNames = [
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

  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setShowModal(true)}>
        <Calendar size={20} color={Colors.primary[900]} />
        <View style={styles.dateTexts}>
          <Text style={styles.dateText}>{formatDate(startDate)}</Text>
          <Text style={styles.dateSeparator}>→</Text>
          <Text style={styles.dateText}>{formatDate(endDate)}</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner une période</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Month navigation */}
            <View style={styles.monthNavigation}>
              <TouchableOpacity onPress={previousMonth} style={styles.navButton}>
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Week days header */}
            <View style={styles.weekDaysRow}>
              {weekDays.map(day => (
                <View key={day} style={styles.weekDayCell}>
                  <Text style={styles.weekDayText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {days.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const isDisabled = isDateDisabled(day);
                const isInRange = isDateInRange(day);
                const isStart = tempStartDate && day.getTime() === tempStartDate.getTime();
                const isEnd = tempEndDate && day.getTime() === tempEndDate.getTime();
                const withData = hasData(day);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      isInRange && styles.dayCellInRange,
                      (isStart || isEnd) && styles.dayCellSelected,
                      isDisabled && styles.dayCellDisabled,
                    ]}
                    onPress={() => !isDisabled && handleDayPress(day)}
                    disabled={isDisabled}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        withData && styles.dayTextWithData,
                        isInRange && styles.dayTextInRange,
                        (isStart || isEnd) && styles.dayTextSelected,
                        isDisabled && styles.dayTextDisabled,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    {withData && !isDisabled && <View style={styles.dataDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected range display */}
            {tempStartDate && (
              <View style={styles.selectionInfo}>
                <Text style={styles.selectionText}>
                  {formatDate(tempStartDate)}
                  {tempEndDate && ` - ${formatDate(tempEndDate)}`}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, !tempStartDate && styles.applyButtonDisabled]}
                onPress={handleApply}
                disabled={!tempStartDate}
              >
                <Text style={styles.applyButtonText}>Appliquer</Text>
              </TouchableOpacity>
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
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dateTexts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  dateSeparator: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  navButton: {
    padding: Spacing.sm,
    width: 40,
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 24,
    color: Colors.primary[900],
    fontWeight: '600',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '600',
    color: Colors.muted.foreground,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCellInRange: {
    backgroundColor: Colors.primary[50],
  },
  dayCellSelected: {
    backgroundColor: Colors.primary[900],
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    color: Colors.text,
  },
  dayTextWithData: {
    fontWeight: '600',
  },
  dayTextInRange: {
    color: Colors.primary[900],
  },
  dayTextSelected: {
    color: Colors.primary.foreground,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: Colors.muted.foreground,
  },
  dataDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary[900],
  },
  selectionInfo: {
    padding: Spacing.md,
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: 8,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resetButton: {
    flex: 1,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  applyButton: {
    flex: 1,
    backgroundColor: Colors.primary[900],
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: Colors.muted.main,
    opacity: 0.5,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
});
