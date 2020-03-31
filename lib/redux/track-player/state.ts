import Book from '../../../model/Book';
import { PlayerState } from '../../react-native-track-player';

export interface TrackPlayerState {
  waitingForBook: boolean;
  activeBook: Book | null;
  playbackState: PlayerState;
}

export const initialState: TrackPlayerState = {
  waitingForBook: false,
  activeBook: null,
  playbackState: PlayerState.None,
};
