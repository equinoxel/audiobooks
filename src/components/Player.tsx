import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import BottomSheet from "reanimated-bottom-sheet";
import {H3, Icon, Separator, Subtitle, Text, View,} from 'native-base';
import Animated from 'react-native-reanimated';
import styled from 'styled-components/native';
import {Dimensions, StatusBar, ViewStyle} from "react-native";
import Slider from '@react-native-community/slider';
import {CircleButton} from "./CircleButton";
import {TrackPlayerThunks} from "../../lib/redux/track-player/thunks";
import {useDispatch} from "react-redux";
import {useTypedSelector} from "../../lib/redux";
import {PlayerState} from "../../lib/react-native-track-player";
import {Thumb} from "./BookCard";
import {BorderlessButton} from "react-native-gesture-handler";
import Chapter from "../../model/Chapter";
import RNTrackPlayer, {useTrackPlayerEvents, useTrackPlayerProgress} from "react-native-track-player";
import useAsyncEffect from "use-async-effect";
import TrackPlayer from "../../lib/TrackPlayer/TrackPlayer";
import {prettyTime} from "../../lib/hmsParser";
import Playlist from "../../lib/TrackPlayer/Playlist";

const SNAP_POINTS = [Math.ceil(Dimensions.get('screen').height - (StatusBar.currentHeight ?? 0)), 96];

const Container = styled.View`
  background-color: white;
  padding: 0 24px;
`;

const HeaderView = styled(Container)`
  border-top-right-radius: 16px;
  border-top-left-radius: 16px;
  align-items: center;
  flex-flow: row nowrap;
  justify-content: space-between;
  height: ${SNAP_POINTS[1]}px;
`;

const BodyView = styled(Container)`
  height: ${SNAP_POINTS[0] - SNAP_POINTS[1]}px;
  padding-top: 1px;
  align-items: center;
  overflow: visible;
`;

const Progress: React.FC<{ containerStyle?: ViewStyle, progressStyle?: ViewStyle, progress: number, position?: number, duration?: number, onProgressChanged?: (newValue: number) => void }> = ({
                                                                                                                                                                                                containerStyle,
                                                                                                                                                                                                onProgressChanged,
                                                                                                                                                                                                progressStyle, progress, duration, position
                                                                                                                                                                                              }) => {
  const [localProgress, setProgress] = useState(progress);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) {
      setProgress(progress);
    }
  }, [progress]);

  const onSlidingStart = useCallback(() => {
    setDragging(true);
  }, []);

  const onSeek = useCallback(() => {
    onProgressChanged?.(localProgress);
    setDragging(false);
  }, []);

  return <>
    {position != undefined && duration != undefined &&
    <View style={{flexDirection: 'row', justifyContent: 'space-between', width: containerStyle?.width}}>
        <Text>{prettyTime(position, true)}</Text>
        <Text>{prettyTime(duration, true)}</Text>
    </View>}
    <Slider
      maximumValue={1}
      minimumValue={0}
      onSlidingStart={onSlidingStart}
      onValueChange={setProgress}
      onSlidingComplete={onSeek}
      value={localProgress}
      minimumTrackTintColor={'#222'}
      maximumTrackTintColor={'#555'}
      style={containerStyle}
    />
    {/*<View style={{ height: 4, flexDirection: 'row', ...containerStyle }}>*/}
    {/*  <View style={{ flex: progress, backgroundColor: 'green', ...progressStyle }}/>*/}
    {/*</View>*/}
  </>
};

const Header: React.FC<{ fall: Animated.Value<number> }> = ({fall}) => {
  const dispatch = useDispatch();
  const dropBook = useCallback(() => dispatch(TrackPlayerThunks.dropBook()), [dispatch]);
  const toggle = useCallback(() => dispatch(TrackPlayerThunks.toggle()), [dispatch]);
  const {position, duration} = useTrackPlayerProgress(200);
  const {playbackState, activeBook, waitingForBook} = useTypedSelector(state => state.trackPlayer);

  return (
    <HeaderView>
      <Animated.View style={{opacity: fall}}>
        <Text>{activeBook?.title}</Text>
        <Text>{activeBook?.author}</Text>
      </Animated.View>
      <Animated.View style={{flexDirection: 'row', opacity: fall}}>
        {activeBook && <CircleButton onPress={dropBook}>
            <Icon type="FontAwesome5" name="stop" style={{fontSize: 12}}/>
        </CircleButton>}
        {activeBook && <CircleButton onPress={toggle}>
            <Icon type="FontAwesome5"
                  name={playbackState == PlayerState.Playing ? 'pause' : playbackState == PlayerState.Paused ? 'play' : 'stop'}
                  style={{fontSize: 12}}/>
        </CircleButton>}
      </Animated.View>
      <Animated.View style={{position: 'absolute', left: 0, right: 0, bottom: 0}}>
        <Progress progress={duration == 0 ? 0 : position / duration}/>
      </Animated.View>
    </HeaderView>
  );
};

export const Player: React.FC = () => {
  const fall = useRef(new Animated.Value(1));
  const {activeBook, playbackState, waitingForBook} = useTypedSelector(state => state.trackPlayer);
  const dispatch = useDispatch();
  const toggle = useCallback(() => dispatch(TrackPlayerThunks.toggle()), [dispatch]);
  const [chapters, setChapters] = useState<Chapter[]>();
  useEffect(() => {
    const subscribed = activeBook?.chapters.observe().subscribe(setChapters);
    return () => {
      try {
        subscribed?.unsubscribe();
      }
      catch (e) {
        console.log(e);
      }
    };
  }, [activeBook]);
  const map = useMemo(() => {
    const zipped = chapters?.map<[string, Chapter]>(chapter => [chapter.downloadURL, chapter]);
    if (zipped) {
      const result: Chapter[][] = [[]];
      let file = 0;
      for (let i = 0; i < zipped.length; i++) {
        const value = zipped[i];
        if (result[file].length > 0 && result[file][0].downloadURL != value[0]) {
          file++;
          result.push([]);
        }
        result[file].push(value[1]);
      }
      return result;
    } else {
      return null;
    }
  }, [chapters]);
  const durations = map?.map(_chapters => _chapters.map(chapter => chapter.duration).reduce((acc, val) => acc + val));
  const [track, setTrack] = useState<string | null>(null);
  const fileIndex = useMemo(() => parseInt(track?.replace(activeBook?.id ?? '', '') ?? ''), [track, activeBook]);

  useAsyncEffect(async () => {
    setTrack(await TrackPlayer.getInstance().getCurrentTrackId());
  }, []);
  useTrackPlayerEvents(['playback-track-changed'], data => {
    setTrack(data.nextTrack);
  });
  const {position, duration} = useTrackPlayerProgress(200);
  const progress = useMemo(() => {
    const index = parseInt(track?.replace(activeBook?.id ?? '', '') ?? '');
    if (isNaN(index)) {
      return 0;
    } else {
      if (durations?.[index] != 0) {
        return 1;
      } else if (duration != 0) {
        return position / duration;
      } else {
        return 0;
      }
    }
  }, [position, durations, duration, track, activeBook]);

  const currentChapter = useMemo(() => {
    if (!map) {
      return null;
    }
    const index = parseInt(track?.replace(activeBook?.id ?? '', '') ?? '');
    const lastDurations = durations?.splice(index);
    const last = (lastDurations?.length ?? 0) > 0 ? lastDurations?.reduce((acc, val) => acc + val) ?? 0 : 0;
    if (last == 0) return null;
    for (let chapter of map[index]) {
      console.log(position, chapter.duration - last);
      return chapter;
    }
    return null;
  }, [position, track]);

  const renderHeader = () => {
    return <Header fall={fall.current}/>;
  };

  const Body = () => {
    return (
      <BodyView>
        <Thumb height={Dimensions.get("window").height * 0.4} source={{uri: activeBook?.thumbnail}}/>
        <Separator style={{backgroundColor: 'transparent'}}/>
        <H3>{activeBook?.title}</H3>
        <Text>{activeBook?.author}</Text>
        <Text>{currentChapter?.title ?? (map != null && map[fileIndex] != null ? `${map[fileIndex][0].title} - ${map[fileIndex][map[fileIndex].length - 1].title}` : 'undefined')}</Text>
        <Separator style={{backgroundColor: 'transparent'}}/>
        <Progress progress={progress} position={position} duration={duration}
                  onProgressChanged={newValue => console.log(newValue, duration * newValue) }
                  containerStyle={{width: '100%', backgroundColor: '#eee'}}
                  progressStyle={{backgroundColor: '#70a5ff'}}/>
        <Separator style={{backgroundColor: 'transparent'}}/>
        <View style={{flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', width: '100%'}}>
          <BorderlessButton style={{height: 36, width: 36, alignItems: 'center', justifyContent: 'center'}}
                            onPress={Playlist.previous}>
            <Icon type="FontAwesome5" name="step-backward" style={{fontSize: 18}}/>
          </BorderlessButton>
          <BorderlessButton onPress={() => Playlist.seekTo(Math.max(0, position - 30))}
                            style={{height: 36, width: 36, alignItems: 'center', justifyContent: 'center'}}>
            <Text>-30s</Text>
          </BorderlessButton>
          <CircleButton size={64} onPress={toggle}>
            <Icon type="FontAwesome5"
                  name={playbackState == PlayerState.Playing ? 'pause' : playbackState == PlayerState.Paused ? 'play' : 'stop'}
                  style={{fontSize: 14}}/>
          </CircleButton>
          <BorderlessButton onPress={() => Playlist.seekTo(Math.min(duration, position + 30))}
                            style={{height: 36, width: 36, alignItems: 'center', justifyContent: 'center'}}>
            <Text>+30s</Text>
          </BorderlessButton>
          <BorderlessButton style={{height: 36, width: 36, alignItems: 'center', justifyContent: 'center'}}
                            onPress={Playlist.next}>
            <Icon type="FontAwesome5" name="step-forward" style={{fontSize: 18}}/>
          </BorderlessButton>
        </View>
        <Separator style={{backgroundColor: 'transparent'}}/>
        <Separator style={{backgroundColor: 'transparent'}}/>
      </BodyView>
    );
  };

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      initialSnap={1}
      enabledBottomInitialAnimation
      enabledHeaderGestureInteraction={activeBook != null}
      enabledContentGestureInteraction={false}
      callbackNode={fall.current}
      renderHeader={renderHeader}
      renderContent={Body}
    />
  );
};
