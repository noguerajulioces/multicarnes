import { useState } from 'react'
import { createInFlightGuard } from '../lib/in-flight-guard'

// Hook fino sobre createInFlightGuard. useState con inicializador lazy crea UNA
// sola instancia del guard al montar y nunca la reemplaza (el setter se descarta),
// así que su flag interno persiste con identidad estable entre renders y muta
// síncronamente entre dos clicks de la misma ráfaga. Devuelve runExclusive:
// envolvé el cuerpo async del handler en runExclusive(async () => {…}) y un segundo
// submit en vuelo se ignora. (useState evita acceder a refs durante el render.)
export function useInFlightGuard() {
  const [runExclusive] = useState(createInFlightGuard)
  return runExclusive
}
