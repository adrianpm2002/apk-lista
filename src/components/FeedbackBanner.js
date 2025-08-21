import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { t } from '../utils/i18n';

/* Responsive feedback banner to avoid overflow on small mobile screens */
export const FeedbackBanner = ({ type='info', message, details, onClose, autoCompactChars=140, allowExpand=true, style }) => {
  const { width, height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  const palette = typeStyles[type] || typeStyles.info;
  const detailsStr = useMemo(()=> !details ? '' : Array.isArray(details)? details.join('\n') : details,[details]);
  const shouldCompact = allowExpand && detailsStr && detailsStr.length > autoCompactChars;
  const shownDetails = shouldCompact && !expanded ? detailsStr.slice(0, autoCompactChars) + '…' : detailsStr;
  const smallDevice = width < 380 || height < 640;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, borderColor: palette.border, paddingVertical: smallDevice?6:10, paddingHorizontal: smallDevice?10:14, top: Platform.select({ ios: 60, android: 56, default: 70 }) }, style]}>
      <View style={styles.row}> 
        <Text style={[styles.message, { color: palette.text, fontSize: smallDevice?12:13 }]} numberOfLines={smallDevice?3:8} adjustsFontSizeToFit={smallDevice} minimumFontScale={0.85}>{message}</Text>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Text style={[styles.closeTxt,{ fontSize: smallDevice?12:14 }]}>✕</Text>
          </Pressable>
        )}
      </View>
      {!!shownDetails && (
        <View style={{ marginTop:4, maxHeight: smallDevice? 90: 130 }}>
          <Text style={[styles.details,{ color: palette.text, fontSize: smallDevice?10:11 }]}>{shownDetails}</Text>
          {shouldCompact && (
            <Pressable onPress={()=> setExpanded(e=> !e)} style={{ marginTop:2, alignSelf:'flex-start' }}>
              <Text style={{ color: palette.text, fontSize: smallDevice?10:11, fontWeight:'600' }}>{expanded? t('banner.less') : t('banner.more')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
};

const typeStyles = {
  success: { bg:'#E8F8F2', border:'#27AE60', text:'#1E8449' },
  error:   { bg:'#FFECEC', border:'#FF9B9B', text:'#B00020' },
  warning: { bg:'#FFF4E5', border:'#F5C07A', text:'#8C4B00' },
  info:    { bg:'#E9F2FF', border:'#7FB3FF', text:'#1B4F72' },
  blocked: { bg:'#FFECEC', border:'#FF9B9B', text:'#B00020' },
  edit:    { bg:'#FFF8E1', border:'#F4C067', text:'#7A4E00' }
};

const styles = StyleSheet.create({
  container:{
    position:'absolute', left:12, right:12,
    borderWidth:1, borderRadius:12, zIndex:5000,
    shadowColor:'#000', shadowOpacity:0.12, shadowRadius:4,
    shadowOffset:{ width:0, height:2 }, elevation:5,
  },
  row:{ flexDirection:'row', alignItems:'flex-start' },
  message:{ flex:1, fontWeight:'700', lineHeight:18 },
  closeBtn:{ marginLeft:8, paddingHorizontal:4, paddingVertical:2 },
  closeTxt:{ fontWeight:'700', color:'#555' },
  details:{ lineHeight:16, fontWeight:'500' }
});

export default FeedbackBanner;
