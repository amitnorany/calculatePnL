import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [activeTab, setActiveTab] = useState('subs'); // 'subs' | 'projects' | 'profile'

  // שערי המרה דינמיים בזמן אמת
  const [exchangeRates, setExchangeRates] = useState({
    ILS: 1,
    USD: 3.7,
    EUR: 4.0,
  });

  // --- הגדרות פרופיל ושכר ---
  const [wageType, setWageType] = useState('monthly'); // 'monthly' | 'hourly'
  const [wageAmount, setWageAmount] = useState('12000');

  // --- מנויים ---
  const [subscriptions, setSubscriptions] = useState([]);

  // טופס מנוי חדש
  const [subName, setSubName] = useState('');
  const [subPrice, setSubPrice] = useState('');
  const [subCurrency, setSubCurrency] = useState('ILS');

  // --- פרויקטים ומכירות ---
  const [projects, setProjects] = useState([]);

  // טופס פרויקט חדש
  const [modalVisible, setModalVisible] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjType, setNewProjType] = useState('paid');

  // טופס מוצר חדש לפרויקט
  const [itemProjId, setItemProjId] = useState(null);
  const [itemName, setItemName] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [itemSellPrice, setItemSellPrice] = useState('');

  // --- מנגנון חלונית אישור מעוצבת (Custom Alert Modal) ---
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: 'אישור',
    confirmColor: '#0284C7',
    onConfirm: () => {},
  });

  const showConfirm = (title, message, onConfirmAction, confirmText = 'אישור', confirmColor = '#EF4444') => {
    setConfirmModal({
      visible: true,
      title,
      message,
      confirmText,
      confirmColor,
      onConfirm: () => {
        onConfirmAction();
        setConfirmModal((prev) => ({ ...prev, visible: false }));
      },
    });
  };

  // טעינת נתונים ושערי חליפין מעודכנים
  useEffect(() => {
    loadData();
    fetchLiveExchangeRates();
  }, []);

  useEffect(() => {
    saveData();
  }, [subscriptions, projects, wageType, wageAmount]);

  // משיכת שערי חליפין בזמן אמת
  const fetchLiveExchangeRates = async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await response.json();
      if (data && data.rates && data.rates.ILS) {
        const usdToIls = data.rates.ILS;
        const eurToIls = data.rates.ILS / data.rates.EUR;
        setExchangeRates({
          ILS: 1,
          USD: usdToIls,
          EUR: eurToIls,
        });
      }
    } catch (e) {
      console.log('Error fetching exchange rates, using fallback rates', e);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem('@subs_data', JSON.stringify({ subscriptions, projects, wageType, wageAmount }));
    } catch (e) {
      console.log('Error saving data', e);
    }
  };

  const loadData = async () => {
    try {
      const data = await AsyncStorage.getItem('@subs_data');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.subscriptions) setSubscriptions(parsed.subscriptions);
        if (parsed.projects) setProjects(parsed.projects);
        if (parsed.wageType) setWageType(parsed.wageType);
        if (parsed.wageAmount) setWageAmount(parsed.wageAmount);
      }
    } catch (e) {
      console.log('Error loading data', e);
    }
  };

  // --- חישובי מנויים ---
  const activeSubs = subscriptions.filter((s) => s.active);
  const cancelledSubs = subscriptions.filter((s) => !s.active);

  const totalMonthlyILS = activeSubs.reduce((sum, s) => {
    const rate = exchangeRates[s.currency] || 1;
    return sum + s.price * rate;
  }, 0);

  const totalYearlyILS = totalMonthlyILS * 12;

  // חישוב השפעת השכר
  const numericWage = parseFloat(wageAmount) || 0;
  let wageImpactText = '';
  if (numericWage > 0) {
    if (wageType === 'monthly') {
      const percent = ((totalMonthlyILS / numericWage) * 100).toFixed(1);
      wageImpactText = `המנויים מהווים ${percent}% מהמשכורת החודשית שלך`;
    } else {
      const hours = (totalMonthlyILS / numericWage).toFixed(1);
      wageImpactText = `אתה עובד ${hours} שעות בחודש בשביל המנויים`;
    }
  }

  // --- פעולות מנויים ---
  const toggleSubStatus = (id) => {
    setSubscriptions(
      subscriptions.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  };

  const addSubscription = () => {
    if (!subName.trim() || !subPrice || isNaN(subPrice)) {
      showConfirm('שגיאה', 'נא להזין שם ומחיר תקינים למנוי', () => {}, 'הבנתי', '#0284C7');
      return;
    }
    const newSub = {
      id: Date.now().toString(),
      name: subName.trim(),
      price: parseFloat(subPrice),
      currency: subCurrency,
      active: true,
      category: 'כללי',
    };
    setSubscriptions([newSub, ...subscriptions]);
    setSubName('');
    setSubPrice('');
  };

  const deleteSubscription = (id) => {
    showConfirm(
      'מחיקת מנוי',
      'האם אתה בטוח שברצונך למחוק מנוי זה לצמיתות?',
      () => setSubscriptions(subscriptions.filter((s) => s.id !== id)),
      'מחק מנוי',
      '#EF4444'
    );
  };

  // --- פעולות פרויקטים ---
  const addProject = () => {
    if (!newProjTitle.trim()) return;
    const newP = {
      id: Date.now().toString(),
      title: newProjTitle.trim(),
      type: newProjType,
      items: [],
    };
    setProjects([newP, ...projects]);
    setNewProjTitle('');
    setModalVisible(false);
  };

  const deleteProject = (projId) => {
    showConfirm(
      'מחיקת דוכן',
      'אזהרה: פעולה זו תמחק את הדוכן ואת כל המכירות והמוצרים שנרשמו בו.',
      () => setProjects(projects.filter((p) => p.id !== projId)),
      'מחק דוכן',
      '#EF4444'
    );
  };

  const addItemToProject = (projId) => {
    if (!itemName.trim() || !itemSellPrice || isNaN(itemSellPrice)) {
      showConfirm('שגיאה', 'נא למלא שם ומחיר מכירה תקין', () => {}, 'הבנתי', '#0284C7');
      return;
    }
    const costVal = newProjType === 'free' ? 0 : parseFloat(itemCost) || 0;

    setProjects(
      projects.map((p) => {
        if (p.id === projId) {
          return {
            ...p,
            items: [
              ...p.items,
              {
                id: Date.now().toString(),
                name: itemName.trim(),
                cost: costVal,
                sellPrice: parseFloat(itemSellPrice),
                soldCount: 0,
              },
            ],
          };
        }
        return p;
      })
    );
    setItemName('');
    setItemCost('');
    setItemSellPrice('');
    setItemProjId(null);
  };

  // הסרת מוצר מהפרויקט עם אזהרה
  const removeItemFromProject = (projId, itemId) => {
    showConfirm(
      'מחיקת מוצר',
      'האם אתה בטוח שברצונך למחוק מוצר זה מהפרויקט?',
      () => {
        setProjects(
          projects.map((p) => {
            if (p.id === projId) {
              return {
                ...p,
                items: p.items.filter((i) => i.id !== itemId),
              };
            }
            return p;
          })
        );
      },
      'מחק מוצר',
      '#EF4444'
    );
  };

  // הוספת מכירה
  const registerSale = (projId, itemId) => {
    setProjects(
      projects.map((p) => {
        if (p.id === projId) {
          return {
            ...p,
            items: p.items.map((i) =>
              i.id === itemId ? { ...i, soldCount: i.soldCount + 1 } : i
            ),
          };
        }
        return p;
      })
    );
  };

  // הורדת/ביטול מכירה אחת עם אזהרה
  const decreaseSale = (projId, itemId, currentCount) => {
    if (currentCount <= 0) return;

    showConfirm(
      'הורדת מכירה',
      'האם אתה בטוח שברצונך להפחית יחידה אחת מסך המכירות של מוצר זה?',
      () => {
        setProjects(
          projects.map((p) => {
            if (p.id === projId) {
              return {
                ...p,
                items: p.items.map((i) =>
                  i.id === itemId && i.soldCount > 0
                    ? { ...i, soldCount: i.soldCount - 1 }
                    : i
                ),
              };
            }
            return p;
          })
        );
      },
      'הפחת מכירה',
      '#F59E0B'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* כותרת מותג */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>כמה זה עולה לי? 💎</Text>
      </View>

      {/* תוכן המסכים */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* === מסך 1: מנויים והוצאות === */}
        {activeTab === 'subs' && (
          <View>
            {/* כרטיסיית סיכום */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>סך ההוצאה הקבועה</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summarySubLabel}>חודשי</Text>
                  <Text style={styles.summaryValue}>₪{totalMonthlyILS.toFixed(1)}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summarySubLabel}>שנתי</Text>
                  <Text style={styles.summaryValue}>₪{totalYearlyILS.toFixed(1)}</Text>
                </View>
              </View>
              {wageImpactText !== '' && (
                <Text style={styles.wageImpact}>{wageImpactText}</Text>
              )}
            </View>

            {/* טופס הוספת מנוי */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>הוספת מנוי חדש</Text>
              <TextInput
                style={styles.input}
                placeholder="שם המנוי (למשל: iCloud)"
                value={subName}
                onChangeText={setSubName}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 8 }]}
                  placeholder="מחיר"
                  keyboardType="numeric"
                  value={subPrice}
                  onChangeText={setSubPrice}
                />
                <View style={styles.currencySelector}>
                  {['ILS', 'USD', 'EUR'].map((curr) => (
                    <TouchableOpacity
                      key={curr}
                      style={[
                        styles.currBtn,
                        subCurrency === curr && styles.currBtnActive,
                      ]}
                      onPress={() => setSubCurrency(curr)}
                    >
                      <Text
                        style={[
                          styles.currBtnText,
                          subCurrency === curr && styles.currBtnTextActive,
                        ]}
                      >
                        {curr === 'ILS' ? '₪' : curr === 'USD' ? '$' : '€'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={addSubscription}>
                <Text style={styles.primaryBtnText}>+ הוסף מנוי</Text>
              </TouchableOpacity>
            </View>

            {/* מנויים פעילים */}
            <Text style={styles.sectionHeader}>מנויים פעילים ({activeSubs.length})</Text>
            {activeSubs.length === 0 ? (
              <Text style={styles.emptyText}>אין מנויים פעילים כרגע.</Text>
            ) : (
              activeSubs.map((sub) => {
                const ilsVal = (sub.price * (exchangeRates[sub.currency] || 1)).toFixed(1);
                return (
                  <View key={sub.id} style={styles.itemCard}>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemName}>{sub.name}</Text>
                      <Text style={styles.itemSubText}>
                        {sub.price} {sub.currency} {sub.currency !== 'ILS' && `(~₪${ilsVal})`}
                      </Text>
                    </View>
                    <View style={styles.itemLeft}>
                      <Switch
                        value={sub.active}
                        onValueChange={() => toggleSubStatus(sub.id)}
                        trackColor={{ false: '#CBD5E1', true: '#38BDF8' }}
                        thumbColor={sub.active ? '#0284C7' : '#F1F5F9'}
                      />
                    </View>
                  </View>
                );
              })
            )}

            {/* מנויים מבוטלים / בהפוגה */}
            {cancelledSubs.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionHeader, { color: '#64748B' }]}>
                  מנויים מבוטלים / בהפוגה ({cancelledSubs.length})
                </Text>
                {cancelledSubs.map((sub) => (
                  <View key={sub.id} style={[styles.itemCard, styles.itemCardInactive]}>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemName, styles.textCrossed]}>{sub.name}</Text>
                      <Text style={styles.itemSubText}>לא פעיל כרגע</Text>
                    </View>
                    <View style={styles.itemLeft}>
                      <TouchableOpacity onPress={() => toggleSubStatus(sub.id)}>
                        <Text style={styles.activateText}>הפעל מחדש</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteSubscription(sub.id)}
                        style={{ marginRight: 12 }}
                      >
                        <Text style={styles.deleteText}>מחק</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* === מסך 2: דוכנים, פרויקטים ומכירות === */}
        {activeTab === 'projects' && (
          <View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.primaryBtnText}>+ יצירת פרויקט / דוכן חדש</Text>
            </TouchableOpacity>

            {projects.length === 0 ? (
              <Text style={styles.emptyText}>עדיין לא נוצרו פרויקטים או דוכנים.</Text>
            ) : (
              projects.map((proj) => {
                const totalCost = proj.items.reduce((s, i) => s + i.cost, 0);
                const totalRevenue = proj.items.reduce(
                  (s, i) => s + i.sellPrice * i.soldCount,
                  0
                );
                const netProfit = totalRevenue - totalCost;

                return (
                  <View key={proj.id} style={styles.projCard}>
                    <View style={styles.projHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.projTitle}>{proj.title}</Text>
                        <Text style={[styles.projBadge, { marginRight: 8 }]}>
                          {proj.type === 'free' ? 'מכירת חצר / 0₪ עלות' : 'סחורה וקניות'}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteProject(proj.id)}>
                        <Text style={styles.deleteText}>מחק דוכן</Text>
                      </TouchableOpacity>
                    </View>

                    {/* שורת סיכום רווח והפסד */}
                    <View style={styles.projStats}>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>הוצאות</Text>
                        <Text style={styles.statValue}>₪{totalCost}</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>הכנסות</Text>
                        <Text style={[styles.statValue, { color: '#0EA5E9' }]}>
                          ₪{totalRevenue}
                        </Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={styles.statLabel}>רווח נקי</Text>
                        <Text
                          style={[
                            styles.statValue,
                            { color: netProfit >= 0 ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          ₪{netProfit}
                        </Text>
                      </View>
                    </View>

                    {/* רשימת המוצרים בפרויקט */}
                    <Text style={styles.subSectionHeader}>מוצרים ומכירה מהירה:</Text>
                    {proj.items.length === 0 ? (
                      <Text style={styles.emptySubText}>אין מוצרים בדוכן זה עדיין.</Text>
                    ) : (
                      proj.items.map((item) => (
                        <View key={item.id} style={styles.saleItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.saleItemName}>{item.name}</Text>
                            <Text style={styles.saleItemSub}>
                              מחיר: ₪{item.sellPrice} | נמכרו: {item.soldCount} יח'
                            </Text>
                          </View>
                          
                          {/* כפתור הוספת מכירה */}
                          <TouchableOpacity
                            style={styles.quickSaleBtn}
                            onPress={() => registerSale(proj.id, item.id)}
                          >
                            <Text style={styles.quickSaleText}>+ מכירה</Text>
                          </TouchableOpacity>

                          {/* כפתור הורדת מכירה */}
                          <TouchableOpacity
                            style={[
                              styles.decreaseSaleBtn,
                              item.soldCount === 0 && { opacity: 0.4 },
                            ]}
                            onPress={() => decreaseSale(proj.id, item.id, item.soldCount)}
                          >
                            <Text style={styles.decreaseSaleText}>- מכירה</Text>
                          </TouchableOpacity>

                          {/* מחיקת מוצר */}
                          <TouchableOpacity
                            onPress={() => removeItemFromProject(proj.id, item.id)}
                            style={{ marginRight: 6 }}
                          >
                            <Text style={styles.deleteText}>מחק</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}

                    {/* הוספת מוצר לפרויקט */}
                    {itemProjId === proj.id ? (
                      <View style={styles.addItemForm}>
                        <TextInput
                          style={styles.input}
                          placeholder="שם המוצר"
                          value={itemName}
                          onChangeText={setItemName}
                        />
                        {proj.type === 'paid' && (
                          <TextInput
                            style={styles.input}
                            placeholder="עלות קנייה כוללת (₪)"
                            keyboardType="numeric"
                            value={itemCost}
                            onChangeText={setItemCost}
                          />
                        )}
                        <TextInput
                          style={styles.input}
                          placeholder="מחיר מכירה ליחידה (₪)"
                          keyboardType="numeric"
                          value={itemSellPrice}
                          onChangeText={setItemSellPrice}
                        />
                        <TouchableOpacity
                          style={styles.secondaryBtn}
                          onPress={() => addItemToProject(proj.id)}
                        >
                          <Text style={styles.secondaryBtnText}>שמור מוצר</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addProdtBtn}
                        onPress={() => setItemProjId(proj.id)}
                      >
                        <Text style={styles.addProdtBtnText}>+ הוסף מוצר לדוכן</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* === מסך 3: הגדרות פרופיל ושכר === */}
        {activeTab === 'profile' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>הגדרות חשבון ושכר</Text>
            <Text style={styles.label}>סוג השכר / הכנסה:</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  wageType === 'monthly' && styles.toggleBtnActive,
                ]}
                onPress={() => setWageType('monthly')}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    wageType === 'monthly' && styles.toggleBtnTextActive,
                  ]}
                >
                  שכר חודשי נטו (שכירים/מבוגרים)
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.row}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  wageType === 'hourly' && styles.toggleBtnActive,
                ]}
                onPress={() => setWageType('hourly')}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    wageType === 'hourly' && styles.toggleBtnTextActive,
                  ]}
                >
                  שכר שעתי (צעירים/שעתי)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { marginTop: 15 }]}>
              {wageType === 'monthly' ? 'סכום משכורת חודשית (₪):' : 'שכר לשעה (₪):'}
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={wageAmount}
              onChangeText={setWageAmount}
            />
          </View>
        )}
      </ScrollView>

      {/* תפריט ניווט תחתון */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('subs')}
        >
          <Text
            style={[
              styles.navText,
              activeTab === 'subs' && styles.navTextActive,
            ]}
          >
            💳 מנויים
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('projects')}
        >
          <Text
            style={[
              styles.navText,
              activeTab === 'projects' && styles.navTextActive,
            ]}
          >
            ⛺ דוכנים ומכירות
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('profile')}
        >
          <Text
            style={[
              styles.navText,
              activeTab === 'profile' && styles.navTextActive,
            ]}
          >
            ⚙️ פרופיל
          </Text>
        </TouchableOpacity>
      </View>

      {/* מודאל ליצירת פרויקט חדש */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.cardTitle}>יצירת פרויקט / דוכן חדש</Text>
            <TextInput
              style={styles.input}
              placeholder="שם הפרויקט"
              value={newProjTitle}
              onChangeText={setNewProjTitle}
            />
            <Text style={styles.label}>סוג המכירה:</Text>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                newProjType === 'paid' && styles.toggleBtnActive,
              ]}
              onPress={() => setNewProjType('paid')}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  newProjType === 'paid' && styles.toggleBtnTextActive,
                ]}
              >
                קנייה ומכירת סחורה
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                newProjType === 'free' && styles.toggleBtnActive,
              ]}
              onPress={() => setNewProjType('free')}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  newProjType === 'free' && styles.toggleBtnTextActive,
                ]}
              >
                מכירת חצר / ללא עלות
              </Text>
            </TouchableOpacity>

            <View style={[styles.row, { marginTop: 15 }]}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginLeft: 8 }]}
                onPress={addProject}
              >
                <Text style={styles.primaryBtnText}>צור פרויקט</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.secondaryBtnText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* מודאל אישור מחיקה/אזהרה מעוצב (Custom Alert) */}
      <Modal visible={confirmModal.visible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>⚠️</Text>
            <Text style={[styles.cardTitle, { textAlign: 'center', marginBottom: 6 }]}>
              {confirmModal.title}
            </Text>
            <Text style={{ textAlign: 'center', color: '#475569', marginBottom: 18, fontSize: 14 }}>
              {confirmModal.message}
            </Text>
            <View style={{ flexDirection: 'row', width: '100%' }}>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { flex: 1, backgroundColor: confirmModal.confirmColor, marginLeft: 8 },
                ]}
                onPress={confirmModal.onConfirm}
              >
                <Text style={styles.primaryBtnText}>{confirmModal.confirmText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { flex: 1 }]}
                onPress={() => setConfirmModal((prev) => ({ ...prev, visible: false }))}
              >
                <Text style={styles.secondaryBtnText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  header: {
    backgroundColor: '#0284C7',
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 100 },

  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginTop: 20,
    fontSize: 14,
  },
  emptySubText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginVertical: 10,
    fontSize: 12,
  },

  // כרטיסיית סיכום
  summaryCard: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: { color: '#E0F2FE', fontSize: 14, textAlign: 'center' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  summaryItem: { alignItems: 'center' },
  summarySubLabel: { color: '#BAE6FD', fontSize: 12 },
  summaryValue: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  wageImpact: {
    color: '#FEF08A',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '500',
  },

  // כרטיסיות כלליות
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0369A1',
    marginBottom: 12,
    textAlign: 'right',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginVertical: 10,
    textAlign: 'right',
  },
  subSectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 10,
    textAlign: 'right',
  },

  // אלמנטי טפסים
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    textAlign: 'right',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  currencySelector: { flexDirection: 'row' },
  currBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 4,
  },
  currBtnActive: { backgroundColor: '#0284C7' },
  currBtnText: { color: '#475569', fontWeight: 'bold' },
  currBtnTextActive: { color: '#FFFFFF' },

  primaryBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginVertical: 4,
  },
  secondaryBtnText: { color: '#0369A1', fontWeight: 'bold' },

  // פריטי מנויים
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    // ✅ תקין:
justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCardInactive: { opacity: 0.6, backgroundColor: '#F8FAFC' },
  itemRight: { alignItems: 'flex-start' },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#1E293B' },
  itemSubText: { fontSize: 12, color: '#64748B' },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  textCrossed: { textDecorationLine: 'line-through' },
  activateText: { color: '#0284C7', fontWeight: 'bold', fontSize: 12 },
  deleteText: { color: '#EF4444', fontSize: 12 },

  // פרויקטים
  projCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginVertical: 10,
    elevation: 2,
  },
  projHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projTitle: { fontSize: 18, fontWeight: 'bold', color: '#0369A1' },
  projBadge: {
    backgroundColor: '#E0F2FE',
    color: '#0284C7',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  projStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginVertical: 10,
  },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#64748B' },
  statValue: { fontSize: 15, fontWeight: 'bold', color: '#1E293B' },

  saleItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  saleItemName: { fontWeight: 'bold', color: '#0F172A' },
  saleItemSub: { fontSize: 11, color: '#475569' },
  quickSaleBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 4,
  },
  quickSaleText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  decreaseSaleBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 4,
  },
  decreaseSaleText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  addProdtBtn: { marginTop: 10, alignItems: 'center' },
  addProdtBtnText: { color: '#0284C7', fontWeight: 'bold' },
  addItemForm: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },

  // הגדרות
  label: { fontSize: 14, color: '#334155', marginBottom: 6, textAlign: 'right' },
  toggleBtn: {
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    width: '100%',
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#0284C7' },
  toggleBtnText: { color: '#334155', fontWeight: '500' },
  toggleBtnTextActive: { color: '#FFFFFF', fontWeight: 'bold' },

  // ניווט תחתון
  navbar: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 12,
  },
  navItem: { flex: 1, alignItems: 'center' },
  navText: { color: '#64748B', fontSize: 13, fontWeight: '500' },
  navTextActive: { color: '#0284C7', fontWeight: 'bold' },

  // מודאל
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
});