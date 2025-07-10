import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';

const PricesButton = ({ onOptionSelect }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedLottery, setExpandedLottery] = useState(null);
  const [expandedSchedule, setExpandedSchedule] = useState(null);
  
  // Animaciones para las transiciones
  const lotteryAnimations = useRef({});
  const scheduleAnimations = useRef({});
  const [prices, setPrices] = useState({
    georgia: {
      label: 'Georgia',
      schedules: {
        mediodia: {
          label: 'Mediodía',
          playTypes: {
            fijo: {
              label: 'Fijo',
              regular: 500,
              limitado: 450,
              listero: 15
            },
            corrido: {
              label: 'Corrido',
              regular: 80,
              limitado: 70,
              listero: 10
            }
          }
        },
        noche: {
          label: 'Noche',
          playTypes: {
            fijo: {
              label: 'Fijo',
              regular: 520,
              limitado: 470,
              listero: 16
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
              regular: 510,
              limitado: 460,
              listero: 15
            }
          }
        },
        noche: {
          label: 'Noche',
          playTypes: {
            tripleta: {
              label: 'Tripleta',
              regular: 4800,
              limitado: 4300,
              listero: 26
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
            corrido: {
              label: 'Corrido',
              regular: 81,
              limitado: 71,
              listero: 10
            }
          }
        }
      }
    }
  });

  const toggleLottery = (lotteryKey) => {
    setExpandedLottery(expandedLottery === lotteryKey ? null : lotteryKey);
    setExpandedSchedule(null);
  };

  const toggleSchedule = (scheduleKey) => {
    setExpandedSchedule(expandedSchedule === scheduleKey ? null : scheduleKey);
  };

  const updatePrice = (lottery, schedule, playType, priceType, newPrice) => {
    setPrices(prevPrices => ({
      ...prevPrices,
      [lottery]: {
        ...prevPrices[lottery],
        schedules: {
          ...prevPrices[lottery].schedules,
          [schedule]: {
            ...prevPrices[lottery].schedules[schedule],
            playTypes: {
              ...prevPrices[lottery].schedules[schedule].playTypes,
              [playType]: {
                ...prevPrices[lottery].schedules[schedule].playTypes[playType],
                [priceType]: parseFloat(newPrice) || 0
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
      type: 'prices_updated',
      prices
    });
  };

  const renderPlayType = (playTypeKey, playTypeData, lottery, schedule) => (
    <View key={playTypeKey} style={styles.playTypeContainer}>
      <Text style={styles.playTypeTitle}>{playTypeData.label}</Text>
      
      <View style={styles.pricesRow}>
        <View style={styles.priceInputContainer}>
          <Text style={styles.priceLabel}>Regular:</Text>
          <Text style={styles.priceValue}>{playTypeData.regular}</Text>
        </View>
        
        <View style={styles.priceInputContainer}>
          <Text style={styles.priceLabel}>Limitado:</Text>
          <Text style={styles.priceValue}>{playTypeData.limitado}</Text>
        </View>
        
        <View style={styles.priceInputContainer}>
          <Text style={styles.priceLabel}>Listero:</Text>
          <Text style={styles.priceValue}>{playTypeData.listero}%</Text>
        </View>
      </View>
    </View>
  );

  const renderSchedule = (scheduleKey, scheduleData, lottery) => (
    <View key={scheduleKey} style={styles.scheduleContainer}>
      <TouchableOpacity
        style={styles.scheduleHeader}
        onPress={() => toggleSchedule(scheduleKey)}
        activeOpacity={0.7}
      >
        <Text style={styles.scheduleTitle}>{scheduleData.label}</Text>
        <Text style={styles.arrow}>
          {expandedSchedule === scheduleKey ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>
      
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
        <Text style={styles.buttonText}>💰</Text>
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
              <Text style={styles.title}>Configuración de Precios</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {Object.entries(prices).map(([lotteryKey, lotteryData]) =>
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
    backgroundColor: '#27ae60',
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
    maxWidth: 450,
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
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  playTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  pricesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceInputContainer: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 4,
    textAlign: 'center',
  },
  priceValue: {
    fontSize: 12,
    color: '#2c3e50',
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
});

export default PricesButton;
