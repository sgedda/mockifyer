import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { initializeMockifyer } from './mockifyer-setup-simple';

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
}

interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}

interface Album {
  id: number;
  userId: number;
  title: string;
}

interface Todo {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [singlePost, setSinglePost] = useState<Post | null>(null);
  const [createdPost, setCreatedPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [initialized, setInitialized] = useState(false);
  const [mockifyerInstance, setMockifyerInstance] = useState<any>(null);

  useEffect(() => {
    // Initialize Mockifyer
    initializeMockifyer().then((instance) => {
      setMockifyerInstance(instance);
      setInitialized(true);
      console.log('[App] Mockifyer initialized');
    });
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5');
      const data = await response.json();
      setPosts(data);
      console.log('[App] Fetched posts:', data.length);
    } catch (error) {
      console.error('[App] Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/users/1');
      const data = await response.json();
      setUser(data);
      console.log('[App] Fetched user:', data);
    } catch (error) {
      console.error('[App] Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSinglePost = async () => {
    setLoading(true);
    setMessage('');
    try {
      const postId = Math.floor(Math.random() * 100) + 1;
      const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${postId}`);
      const data = await response.json();
      setSinglePost(data);
      setMessage(`Fetched post #${postId}`);
      console.log('[App] Fetched single post:', data);
    } catch (error) {
      console.error('[App] Error fetching single post:', error);
      setMessage('Error fetching post');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    setMessage('');
    try {
      const postId = Math.floor(Math.random() * 10) + 1;
      const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${postId}/comments`);
      const data = await response.json();
      setComments(data);
      setMessage(`Fetched ${data.length} comments for post #${postId}`);
      console.log('[App] Fetched comments:', data.length);
    } catch (error) {
      console.error('[App] Error fetching comments:', error);
      setMessage('Error fetching comments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlbums = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/albums?_limit=5');
      const data = await response.json();
      setAlbums(data);
      setMessage(`Fetched ${data.length} albums`);
      console.log('[App] Fetched albums:', data.length);
    } catch (error) {
      console.error('[App] Error fetching albums:', error);
      setMessage('Error fetching albums');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodos = async () => {
    setLoading(true);
    setMessage('');
    try {
      const userId = Math.floor(Math.random() * 10) + 1;
      const response = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}/todos?_limit=5`);
      const data = await response.json();
      setTodos(data);
      setMessage(`Fetched ${data.length} todos for user #${userId}`);
      console.log('[App] Fetched todos:', data.length);
    } catch (error) {
      console.error('[App] Error fetching todos:', error);
      setMessage('Error fetching todos');
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Post',
          body: 'This is a test post created via POST request',
          userId: 1,
        }),
      });
      const data = await response.json();
      setCreatedPost(data);
      setMessage(`Created post #${data.id}`);
      console.log('[App] Created post:', data);
    } catch (error) {
      console.error('[App] Error creating post:', error);
      setMessage('Error creating post');
    } finally {
      setLoading(false);
    }
  };

  const updatePost = async () => {
    setLoading(true);
    setMessage('');
    try {
      const postId = Math.floor(Math.random() * 100) + 1;
      const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: postId,
          title: 'Updated Post Title',
          body: 'This post was updated via PUT request',
          userId: 1,
        }),
      });
      const data = await response.json();
      setMessage(`Updated post #${data.id}`);
      console.log('[App] Updated post:', data);
    } catch (error) {
      console.error('[App] Error updating post:', error);
      setMessage('Error updating post');
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async () => {
    setLoading(true);
    setMessage('');
    try {
      const postId = Math.floor(Math.random() * 100) + 1;
      const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${postId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMessage(`Deleted post #${postId} (simulated)`);
        console.log('[App] Deleted post:', postId);
      }
    } catch (error) {
      console.error('[App] Error deleting post:', error);
      setMessage('Error deleting post');
    } finally {
      setLoading(false);
    }
  };

  const fetchWithQueryParams = async () => {
    setLoading(true);
    setMessage('');
    try {
      const userId = Math.floor(Math.random() * 10) + 1;
      const response = await fetch(`https://jsonplaceholder.typicode.com/posts?userId=${userId}&_limit=3`);
      const data = await response.json();
      setPosts(data);
      setMessage(`Fetched ${data.length} posts for user #${userId} (with query params)`);
      console.log('[App] Fetched posts with query params:', data.length);
    } catch (error) {
      console.error('[App] Error fetching posts with query:', error);
      setMessage('Error fetching posts');
    } finally {
      setLoading(false);
    }
  };

  const reloadMocks = async () => {
    setMessage('');
    setLoading(true);
    try {
      // Use Mockifyer's built-in reload method (no Metro dependency)
      if (mockifyerInstance && typeof mockifyerInstance.reloadMockData === 'function') {
        console.log('[App] 🔄 Starting reload...');
        await mockifyerInstance.reloadMockData();
        setMessage('✅ Mock files reloaded - new files will be used on next request');
        console.log('[App] ✅ Mock files reloaded - cache cleared');
        console.log('[App] 💡 Make a new API request to see updated data');
      } else {
        setMessage('⚠️ Mockifyer instance not available');
      }
    } catch (error) {
      console.error('[App] Error reloading mocks:', error);
      setMessage('⚠️ Error reloading mocks');
    } finally {
      setLoading(false);
    }
  };

  const clearData = async () => {
    // Clear UI state
    setPosts([]);
    setUser(null);
    setComments([]);
    setAlbums([]);
    setTodos([]);
    setSinglePost(null);
    setCreatedPost(null);
    setMessage('');
    
    // Clear Mockifyer mocks
    if (mockifyerInstance && typeof mockifyerInstance.clearAllMocks === 'function') {
      try {
        console.log('[App] Clearing all Mockifyer mocks...');
        await mockifyerInstance.clearAllMocks();
        console.log('[App] ✅ All mocks cleared');
        setMessage('All mocks cleared');
      } catch (error) {
        console.error('[App] Error clearing mocks:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Mockifyer Expo Example</Text>
        <Text style={styles.subtitle}>
          {initialized ? '✅ Mockifyer Ready' : '⏳ Initializing...'}
        </Text>
        <Text style={styles.mode}>
          Mode: {__DEV__ ? 'Development (FileSystem)' : 'Production (Memory)'}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, loading && styles.buttonDisabled]} 
            onPress={fetchPosts}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>GET Posts</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, loading && styles.buttonDisabled]} 
            onPress={fetchUser}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>GET User</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, loading && styles.buttonDisabled]} 
            onPress={fetchSinglePost}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>GET Post</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, loading && styles.buttonDisabled]} 
            onPress={fetchComments}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>GET Comments</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, loading && styles.buttonDisabled]} 
            onPress={fetchAlbums}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>GET Albums</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, loading && styles.buttonDisabled]} 
            onPress={fetchTodos}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>GET Todos</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, styles.buttonPost, loading && styles.buttonDisabled]} 
            onPress={createPost}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>POST Create</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, styles.buttonPut, loading && styles.buttonDisabled]} 
            onPress={updatePost}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>PUT Update</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, styles.buttonDelete, loading && styles.buttonDisabled]} 
            onPress={deletePost}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>DELETE</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonSmall, loading && styles.buttonDisabled]} 
            onPress={fetchWithQueryParams}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>GET Query</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonReload, loading && styles.buttonDisabled]} 
            onPress={reloadMocks}
            disabled={loading || !initialized}
          >
            <Text style={styles.buttonText}>🔄 Reload Mocks</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonClear]} 
            onPress={clearData}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {message ? (
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {posts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Posts ({posts.length})</Text>
            {posts.map((post) => (
              <View key={post.id} style={styles.card}>
                <Text style={styles.cardTitle}>{post.title}</Text>
                <Text style={styles.cardBody}>{post.body}</Text>
              </View>
            ))}
          </View>
        )}

        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{user.name}</Text>
              <Text style={styles.cardBody}>@{user.username}</Text>
              <Text style={styles.cardBody}>{user.email}</Text>
            </View>
          </View>
        )}

        {singlePost && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Single Post</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{singlePost.title}</Text>
              <Text style={styles.cardBody}>{singlePost.body}</Text>
            </View>
          </View>
        )}

        {createdPost && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Created Post (POST)</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>ID: {createdPost.id}</Text>
              <Text style={styles.cardTitle}>{createdPost.title}</Text>
              <Text style={styles.cardBody}>{createdPost.body}</Text>
            </View>
          </View>
        )}

        {comments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comments ({comments.length})</Text>
            {comments.slice(0, 3).map((comment) => (
              <View key={comment.id} style={styles.card}>
                <Text style={styles.cardTitle}>{comment.name}</Text>
                <Text style={styles.cardBody}>{comment.email}</Text>
                <Text style={styles.cardBody}>{comment.body}</Text>
              </View>
            ))}
          </View>
        )}

        {albums.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Albums ({albums.length})</Text>
            {albums.map((album) => (
              <View key={album.id} style={styles.card}>
                <Text style={styles.cardTitle}>Album #{album.id}</Text>
                <Text style={styles.cardBody}>{album.title}</Text>
              </View>
            ))}
          </View>
        )}

        {todos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Todos ({todos.length})</Text>
            {todos.map((todo) => (
              <View key={todo.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {todo.completed ? '✅' : '⏳'} {todo.title}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!initialized && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Initializing Mockifyer...
            </Text>
          </View>
        )}

        {initialized && posts.length === 0 && !user && !comments.length && !albums.length && !todos.length && !singlePost && !createdPost && !loading && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Tap any button to make API calls.{'\n'}
              {__DEV__ && 'In development mode, responses will be saved to mock-data/.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
  },
  mode: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 90,
  },
  buttonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPost: {
    backgroundColor: '#34C759',
  },
  buttonPut: {
    backgroundColor: '#FF9500',
  },
  buttonDelete: {
    backgroundColor: '#FF3B30',
  },
  buttonReload: {
    backgroundColor: '#5856D6',
    minWidth: 120,
  },
  buttonClear: {
    backgroundColor: '#8E8E93',
    minWidth: 100,
  },
  messageContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  messageText: {
    color: '#1976D2',
    fontSize: 14,
    textAlign: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  cardBody: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

