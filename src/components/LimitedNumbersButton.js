import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  FlatList,
  Animated,
} from 'react-native';

const LimitedNumbersButton = ({ onOptionSelect }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedLottery, setExpandedLottery] = useState(null);
  const [expandedSchedule, setExpandedSchedule] = useState(null);
  
  // Animaciones para las transiciones
  const lotteryAnimations = useRef({});
  const scheduleAnimations = useRef({});

  const limitedNumbers = {
    georgia: {
      label: 'Georgia',
      schedules: {
        mediodia: {
          label: 'Mediodía',
          playTypes: {
            fijo: {
              label: 'Fijo',
              numbers: ['123', '456', '789']
            },
            corrido: {
              label: 'Corrido',
              numbers: ['234', '567']
            },
            parle: {
              label: 'Parle',
              numbers: ['345']
            }
          }
        },
        noche: {
          label: 'Noche',
          playTypes: {
            fijo: {
              label: 'Fijo',
              numbers: ['111', '222']
            },
            corrido: {
              label: 'Corrido',
              numbers: ['444']
            }
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
            fijo: {
              label: 'Fijo',
              numbers: ['000', '999']
            },
            tripleta: {
              label: 'Tripleta',
              numbers: ['777']
            }
          }
        },
        noche: {
          label: 'Noche',
          playTypes: {
            centena: {
              label: 'Centena',
              numbers: ['100', '200']
            }
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
            fijo: {
              label: 'Fijo',
              numbers: ['001', '002']
            }
          }
        },
        noche: {
          label: 'Noche',
          playTypes: {
            parle: {
              label: 'Parle',
              numbers: ['004']
            }
          }
        }
      }
    }
  };

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

  const handleNumberSelect = (lottery, schedule, playType, number) => {
    onOptionSelect && onOptionSelect({
      type: 'limited_number',
      lottery,
      schedule,
      playType,
      number
    });
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
    setExpandedLottery(null);
    setExpandedSchedule(null);
  };

  const renderPlayType = (playTypeKey, playTypeData, lottery, schedule) => (
    <View key={playTypeKey} style={styles.playTypeContainer}>
      <Text style={styles.playTypeTitle}>{playTypeData.label}</Text>
      <View style={styles.numbersContainer}>
        {playTypeData.numbers.map((number, index) => (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.numberButton,
              pressed && styles.numberButtonPressed
            ]}
            onPress={() => handleNumberSelect(lottery, schedule, playTypeKey, number)}
          >
            <Text style={styles.numberText}>{number}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderSchedule = (scheduleKey, scheduleData, lottery) => {
    const animKey = `${lottery}_${scheduleKey}`;
    const isExpanded = expandedSchedule === scheduleKey;
    
    return (
      <View key={scheduleKey} style={styles.scheduleContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.scheduleHeader,
            pressed && styles.buttonPressed
          ]}
          onPress={() => toggleSchedule(scheduleKey)}
        >
          <Text style={styles.scheduleTitle}>{scheduleData.label}</Text>
          <Text style={styles.arrow}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </Pressable>
        
        {isExpanded && (
          <Animated.View 
            style={[
              styles.playTypesContainer,
              {
                opacity: scheduleAnimations.current[animKey] || 0,
                transform: [{
                  scaleY: scheduleAnimations.current[animKey] || 0
                }]
              }
            ]}
          >
            {Object.entries(scheduleData.playTypes).map(([playTypeKey, playTypeData]) =>
              renderPlayType(playTypeKey, playTypeData, lottery, scheduleKey)
            )}
          </Animated.View>
        )}
      </View>
    );
  };

  const renderLottery = (lotteryKey, lotteryData) => {
    const isExpanded = expandedLottery === lotteryKey;
    
    return (
      <View key={lotteryKey} style={styles.lotteryContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.lotteryHeader,
            pressed && styles.buttonPressed
          ]}
          onPress={() => toggleLottery(lotteryKey)}
        >
          <Text style={styles.lotteryTitle}>{lotteryData.label}</Text>
          <Text style={styles.arrow}>
            {isExpanded ? '▼' : '▶'}
          </Text>
        </Pressable>
        
        {isExpanded && (
          <Animated.View 
            style={[
              styles.schedulesContainer,
              {
                opacity: lotteryAnimations.current[lotteryKey] || 0,
                transform: [{
                  scaleY: lotteryAnimations.current[lotteryKey] || 0
                }]
              }
            ]}
          >
            {Object.entries(lotteryData.schedules).map(([scheduleKey, scheduleData]) =>
              renderSchedule(scheduleKey, scheduleData, lotteryKey)
            )}
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.buttonText}>📊</Text>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Números Limitados</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={handleClose}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
            
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {Object.entries(limitedNumbers).map(([lotteryKey, lotteryData]) =>
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
    backgroundColor: '#3498db',
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
    marginBottom: 8,
  },
  playTypeTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7f8c8d',
    marginBottom: 4,
  },
  numbersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  numberButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    margin: 2,
  },
  numberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  numberButtonPressed: {
    opacity: 0.7,
    backgroundColor: '#2980b9',
    transform: [{ scale: 0.95 }],
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});

export default LimitedNumbersButton;
