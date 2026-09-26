/**
 * @format
 */

// Must be the first import: react-native-gesture-handler (a react-navigation
// dependency) requires its native event handling registered before any
// other module touches the RN gesture responder system.
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
