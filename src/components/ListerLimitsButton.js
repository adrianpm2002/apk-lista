import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';

const ListerLimitsButton = ({ onOptionSelect }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedLottery, setExpandedLottery] = useState(null);
  const [expandedSchedule, setExpandedSchedule] = useState(null);
  
  // Animaciones para las transiciones
  const lotteryAnimations = useRef({});
  const scheduleAnimations = useRef({});
  const [limits, setLimits] = useState({
    georgia: {
      label: 'Georgia',
      schedules: {
        mediodia: {
          label: 'Mediodía',
          playTypes: {
            fijo: { label: 'Fijo', limit: 1000 },
            corrido: { label: 'Corrido', limit: 800 }
          }
        },
        noche: {
          label: 'Noche',
          playTypes: {
            fijo: { label: 'Fijo', limit: 1200 },
            corrido: { label: 'Corrido', limit: 900 }
          }
        }
      }
    },
    florida: {
      label: 'Florida',
      schedules: {
        mediodia: {
          label: 'Mediodía',
          playTypes: {
            fijo: { label: 'Fijo', limit: 1100 },
            tripleta: { label: 'Tripleta', limit: 220 }
          }
        },
        noche: {
          label: 'Noche',
          playTypes: {
            centena: { label: 'Centena', limit: 450 }
          }
        }
      }
    },
    newyork: {
      label: 'New York',
      schedules: {
        mediodia: {
          label: 'Mediodía',
          playTypes: {
            fijo: { label: 'Fijo', limit: 1050 }
          }
        },
        noche: {
          label: 'Noche',
          playTypes: {
            parle: { label: 'Parlé', limit: 620 }
          }
        }
      }
    }
  });

  const toggleLottery = (lotteryKey) => {
    if (!lotteryAnimations.current[lotteryKey]) {
      lotteryAnimations.current[lotteryKey] = new Animated.Value(0);
    }
    
    const isExpanding = expandedLottery !== lotteryKey;
    
    if (isExpanding) {
      setExpandedLottery(lotteryKey);
      setExpandedSchedule(null);
      Animated.timing(lotteryAnimations.current[lotteryKey], {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(lotteryAnimations.current[lotteryKey], {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setExpandedLottery(null);
      });
    }
  };

  const toggleSchedule = (scheduleKey) => {
    const animKey = `${expandedLottery}_${scheduleKey}`;
    if (!scheduleAnimations.current[animKey]) {
      scheduleAnimations.current[animKey] = new Animated.Value(0);
    }
    
    const isExpanding = expandedSchedule !== scheduleKey;
    
    if (isExpanding) {
      setExpandedSchedule(scheduleKey);
      Animated.timing(scheduleAnimations.current[animKey], {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(scheduleAnimations.current[animKey], {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start(() => {
        setExpandedSchedule(null);
      });
    }
  };

  const updateLimit = (lottery, schedule, playType, newLimit) => {
    setLimits(prevLimits => ({
      ...prevLimits,
      [lottery]: {
        ...prevLimits[lottery],
        schedules: {
          ...prevLimits[lottery].schedules,
          [schedule]: {
            ...prevLimits[lottery].schedules[schedule],
            playTypes: {
              ...prevLimits[lottery].schedules[schedule].playTypes,
              [playType]: {
                ...prevLimits[lottery].schedules[schedule].playTypes[playType],
                limit: parseFloat(newLimit) || 0
              }
            }
          }
        }
      }
    }));
  };

  const handleClose = () => {
    setIsVisible(false);
    setExpandedLottery(null);
    setExpandedSchedule(null);
    onOptionSelect && onOptionSelect({
      type: 'lister_limits_updated',
      limits
    });
  };

  const renderPlayType = (playTypeKey, playTypeData, lottery, schedule) => (
    <View key={playTypeKey} style={styles.playTypeContainer}>
      <Text style={styles.playTypeTitle}>{playTypeData.label}</Text>
      <View style={styles.limitInputContainer}>
        <Text style={styles.limitLabel}>Límite: $</Text>
        <Text style={styles.limitValue}>{playTypeData.limit}</Text>
      </View>
    </View>
  );

  const renderSchedule = (scheduleKey, scheduleData, lottery) => (
    <View key={scheduleKey} style={styles.scheduleContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.scheduleHeader,
          pressed && styles.headerPressed
        ]}
        onPress={() => toggleSchedule(scheduleKey)}
      >
        <Text style={styles.scheduleTitle}>{scheduleData.label}</Text>
        <Text style={styles.arrow}>
          {expandedSchedule === scheduleKey ? '▼' : '▶'}
        </Text>
      </Pressable>
      
      {expandedSchedule === scheduleKey && (
        <View style={styles.playTypesContainer}>
          {Object.entries(scheduleData.playTypes).map(([playTypeKey, playTypeData]) =>
            renderPlayType(playTypeKey, playTypeData, lottery, scheduleKey)
          )}
        </View>
      )}
    </View>
  );

  const renderLottery = (lotteryKey, lotteryData) => (
    <View key={lotteryKey} style={styles.lotteryContainer}>
      <TouchableOpacity
        style={styles.lotteryHeader}
        onPress={() => toggleLottery(lotteryKey)}
        activeOpacity={0.7}
      >
        <Text style={styles.lotteryTitle}>{lotteryData.label}</Text>
        <Text style={styles.arrow}>
          {expandedLottery === lotteryKey ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>
      
      {expandedLottery === lotteryKey && (
        <View style={styles.schedulesContainer}>
          {Object.entries(lotteryData.schedules).map(([scheduleKey, scheduleData]) =>
            renderSchedule(scheduleKey, scheduleData, lotteryKey)
          )}
        </View>
      )}
    </View>
  );

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setIsVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>⚠️</Text>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Límites del Listero</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {Object.entries(limits).map(([lotteryKey, lotteryData]) =>
                renderLottery(lotteryKey, lotteryData)
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  buttonText: {
    fontSize: 16,
    color: '#fff',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    maxHeight: 400,
    padding: 16,
  },
  lotteryContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
  },
  lotteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ecf0f1',
  },
  lotteryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  arrow: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  schedulesContainer: {
    padding: 8,
  },
  scheduleContainer: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d5dbdb',
    borderRadius: 6,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f8f9fa',
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#34495e',
  },
  playTypesContainer: {
    padding: 8,
  },
  playTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#fafafa',
    borderRadius: 4,
  },
  playTypeTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
    flex: 1,
  },
  limitInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  limitLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginRight: 4,
  },
  limitValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    minWidth: 80,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  headerPressed: {
    backgroundColor: '#ecf0f1',
    opacity: 0.8,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});

export default ListerLimitsButton;
