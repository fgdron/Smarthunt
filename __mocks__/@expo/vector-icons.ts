// Mock @expo/vector-icons — remplace les icônes par un Text simple en test
import React from 'react';
import { Text } from 'react-native';

const createIconSet = () => {
  const Icon = ({ name, ...props }: { name: string; [key: string]: unknown }) =>
    React.createElement(Text, { testID: `icon-${name}`, ...props });
  return Icon;
};

const Ionicons        = createIconSet();
const MaterialIcons   = createIconSet();
const FontAwesome     = createIconSet();
const FontAwesome5    = createIconSet();
const AntDesign       = createIconSet();
const Entypo          = createIconSet();
const EvilIcons       = createIconSet();
const Feather         = createIconSet();
const Foundation      = createIconSet();
const MaterialCommunityIcons = createIconSet();
const Octicons        = createIconSet();
const SimpleLineIcons = createIconSet();
const Zocial          = createIconSet();

export {
  Ionicons, MaterialIcons, FontAwesome, FontAwesome5, AntDesign, Entypo,
  EvilIcons, Feather, Foundation, MaterialCommunityIcons, Octicons,
  SimpleLineIcons, Zocial,
};
