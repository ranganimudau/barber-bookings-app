import { Keyboard, Platform } from "react-native";
import { useEffect, useState } from "react";

export function useKeyboardInset() {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => setKeyboardInset(e?.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardInset(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return keyboardInset;
}

