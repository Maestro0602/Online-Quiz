import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameGateway } from '../src/socket/handler.js';
import { store } from '../src/data/store.js';
import { GameSession } from '@quizchaos/shared';

interface EmittedEvent {
  room: string;
  event: string;
  payload: any;
}

function createMockGateway() {
  const gateway = new GameGateway();
  const roomEvents: EmittedEvent[] = [];
  const socketEvents: { event: string; payload: any }[] = [];

  (gateway as any).server = {
    to(room: string) {
      return {
        emit(event: string, payload: any) {
          roomEvents.push({ room, event, payload });
        }
      };
    }
  };

  const mockSocket: any = {
    join() {},
    emit(event: string, payload: any) {
      socketEvents.push({ event, payload });
    }
  };

  return { gateway, roomEvents, socketEvents, mockSocket };
}

function createLobbySession(roomCode: string): GameSession {
  const session: GameSession = {
    id: `sess-${roomCode}`,
    quiz_id: 'quiz-cs-101',
    quiz_title: 'Computer Science & Web Dev Showdown',
    room_code: roomCode,
    status: 'lobby',
    team_count: 2,
    current_question_index: -1,
    total_questions: 5,
    host_user_id: 'u-inst-1',
    created_at: new Date().toISOString(),
    teams: [
      {
        id: `team-${roomCode}-1`,
        session_id: roomCode,
        name: 'Red Rockets',
        color: '#e21b3c',
        badge: 'R',
        total_score: 0,
        members: []
      },
      {
        id: `team-${roomCode}-2`,
        session_id: roomCode,
        name: 'Blue Blasters',
        color: '#1368ce',
        badge: 'B',
        total_score: 0,
        members: []
      }
    ]
  };
  store.sessions.set(roomCode, session);
  return session;
}

describe('GameGateway Live Lobby & Team Sync Gameplay', () => {
  const roomCode = '991122';

  beforeEach(() => {
    store.sessions.delete(roomCode);
  });

  it('adds, removes, and redistributes players when resizing team count', () => {
    const { gateway } = createMockGateway();
    const session = createLobbySession(roomCode);

    gateway.handleAddPlayer({ room_code: roomCode, user_name: 'Alice' });
    gateway.handleAddPlayer({ room_code: roomCode, user_name: 'Bob' });
    gateway.handleAddPlayer({ room_code: roomCode, user_name: 'Charlie' });
    gateway.handleAddPlayer({ room_code: roomCode, user_name: 'Dana' });

    assert.equal(session.teams[0].members.length, 2);
    assert.equal(session.teams[1].members.length, 2);

    // Resize from 2 teams to 4 teams
    gateway.handleSetTeamCount({ room_code: roomCode, team_count: 4 });
    assert.equal(session.teams.length, 4);
    assert.ok(session.teams.every(t => t.members.length === 1));

    // Remove a player
    const targetId = session.teams[0].members[0].id;
    gateway.handleRemovePlayer({ room_code: roomCode, member_id: targetId });
    const totalLeft = session.teams.reduce((sum, t) => sum + t.members.length, 0);
    assert.equal(totalLeft, 3);
  });

  it('emits live question:progress, team:member_picked, and unanimous +100 Team Sync Bonus', () => {
    const { gateway, roomEvents, mockSocket } = createMockGateway();
    const session = createLobbySession(roomCode);

    // Team 1: 2 players (both will answer correctly -> +100 bonus)
    session.teams[0].members.push(
      { id: 'm1', user_id: 'u1', user_name: 'Alex', team_id: session.teams[0].id, individual_score: 0, is_online: true, avatar: 'AL' },
      { id: 'm2', user_id: 'u2', user_name: 'Diana', team_id: session.teams[0].id, individual_score: 0, is_online: true, avatar: 'DI' }
    );
    // Team 2: 2 players (split answers -> NO bonus)
    session.teams[1].members.push(
      { id: 'm3', user_id: 'u3', user_name: 'Bella', team_id: session.teams[1].id, individual_score: 0, is_online: true, avatar: 'BE' },
      { id: 'm4', user_id: 'u4', user_name: 'Carlos', team_id: session.teams[1].id, individual_score: 0, is_online: true, avatar: 'CA' }
    );

    gateway.handleStartSession({ room_code: roomCode });
    const q = session.current_question!;
    assert.equal(session.status, 'question_active');

    // Initial progress event should report 0 / 4
    const initialProgress = roomEvents.find(e => e.event === 'question:progress');
    assert.deepEqual(initialProgress?.payload, { answers_received: 0, total_players: 4 });

    // Team 1 both pick the correct option
    gateway.handleSubmitAnswer(
      { room_code: roomCode, user_id: 'u1', question_id: q.id, selected_option_index: q.correct_option_index, time_remaining: 20 },
      mockSocket
    );
    gateway.handleSubmitAnswer(
      { room_code: roomCode, user_id: 'u2', question_id: q.id, selected_option_index: q.correct_option_index, time_remaining: 20 },
      mockSocket
    );

    const team1Bonuses = roomEvents.filter(e => e.event === 'team:sync_bonus' && e.payload.team_id === session.teams[0].id);
    assert.equal(team1Bonuses.length, 1);
    assert.equal(team1Bonuses[0].payload.bonus_points, 100);
    // 1000 + 1000 + 100 sync bonus = 2100
    assert.equal(session.teams[0].total_score, 2100);

    // Team 2 splits answers (one right, one wrong) -> no sync bonus
    const wrongIdx = (q.correct_option_index + 1) % q.options.length;
    gateway.handleSubmitAnswer(
      { room_code: roomCode, user_id: 'u3', question_id: q.id, selected_option_index: q.correct_option_index, time_remaining: 20 },
      mockSocket
    );
    gateway.handleSubmitAnswer(
      { room_code: roomCode, user_id: 'u4', question_id: q.id, selected_option_index: wrongIdx, time_remaining: 20 },
      mockSocket
    );

    const team2Bonuses = roomEvents.filter(e => e.event === 'team:sync_bonus' && e.payload.team_id === session.teams[1].id);
    assert.equal(team2Bonuses.length, 0);
    assert.equal(session.teams[1].total_score, 1000);

    // Final progress should report 4 / 4
    const progressEvents = roomEvents.filter(e => e.event === 'question:progress');
    assert.deepEqual(progressEvents[progressEvents.length - 1].payload, { answers_received: 4, total_players: 4 });

    // Teammate picks were emitted for all 4 submissions
    const pickEvents = roomEvents.filter(e => e.event === 'team:member_picked');
    assert.equal(pickEvents.length, 4);
  });

  it('does not award Team Sync Bonus to a 1-player team', () => {
    const soloRoom = '991123';
    store.sessions.delete(soloRoom);
    const { gateway, roomEvents, mockSocket } = createMockGateway();
    const session = createLobbySession(soloRoom);

    session.teams[0].members.push({
      id: 'm1',
      user_id: 'u-solo',
      user_name: 'SoloPlayer',
      team_id: session.teams[0].id,
      individual_score: 0,
      is_online: true,
      avatar: 'SO'
    });

    gateway.handleStartSession({ room_code: soloRoom });
    const q = session.current_question!;

    gateway.handleSubmitAnswer(
      { room_code: soloRoom, user_id: 'u-solo', question_id: q.id, selected_option_index: q.correct_option_index, time_remaining: 20 },
      mockSocket
    );

    const bonuses = roomEvents.filter(e => e.event === 'team:sync_bonus');
    assert.equal(bonuses.length, 0);
    assert.equal(session.teams[0].total_score, 1000);
    store.sessions.delete(soloRoom);
  });
});
