import { useEffect, useState } from 'react';
import { Box, Button, Text, Progress, Stack } from '@chakra-ui/react';
import { useAutoUpdate } from '@renderer/hooks/useAutoUpdate';

export const UpdateNotification = () => {
  const {
    status,
    updateInfo,
    progress,
    error,
    currentVersion,
    downloadUpdate,
    installUpdate,
  } = useAutoUpdate();

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const shouldShow = status === 'available' || status === 'downloading' || status === 'downloaded' || status === 'error';
    setIsVisible(shouldShow);
  }, [status]);

  if (!isVisible) return null;

  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    const mbps = bytesPerSecond / (1024 * 1024);
    return `${mbps.toFixed(2)} MB/s`;
  };

  const handleDownload = () => {
    downloadUpdate();
  };

  const handleInstall = () => {
    installUpdate();
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  return (
    <Box
      position="fixed"
      top={4}
      right={4}
      width="400px"
      bg="bg.panel"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border"
      p={4}
      shadow="lg"
      zIndex={9999}
    >
      <Stack gap={3}>
        {status === 'available' && (
          <>
            <Box>
              <Text fontSize="lg" fontWeight="bold">
                Update Available
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Version {updateInfo?.version} is now available
              </Text>
              {currentVersion && (
                <Text fontSize="xs" color="fg.muted">
                  Current version: {currentVersion}
                </Text>
              )}
            </Box>

            {updateInfo?.releaseNotes && (
              <Box
                maxH="100px"
                overflowY="auto"
                bg="bg.muted"
                p={2}
                borderRadius="sm"
                fontSize="sm"
              >
                <Text whiteSpace="pre-wrap">{updateInfo.releaseNotes}</Text>
              </Box>
            )}

            <Stack direction="row" gap={2}>
              <Button size="sm" colorScheme="blue" onClick={handleDownload}>
                Download Update
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                Later
              </Button>
            </Stack>
          </>
        )}

        {status === 'downloading' && progress && (
          <>
            <Box>
              <Text fontSize="lg" fontWeight="bold">
                Downloading Update
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Version {updateInfo?.version}
              </Text>
            </Box>

            <Box>
              <Progress.Root value={progress.percent} size="sm">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
              <Stack direction="row" justify="space-between" mt={1}>
                <Text fontSize="xs" color="fg.muted">
                  {progress.percent}%
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {formatSpeed(progress.bytesPerSecond)}
                </Text>
              </Stack>
            </Box>
          </>
        )}

        {status === 'downloaded' && (
          <>
            <Box>
              <Text fontSize="lg" fontWeight="bold">
                Update Ready
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Version {updateInfo?.version} has been downloaded
              </Text>
            </Box>

            <Stack direction="row" gap={2}>
              <Button size="sm" colorScheme="green" onClick={handleInstall}>
                Restart and Install
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                Later
              </Button>
            </Stack>
          </>
        )}

        {status === 'error' && error && (
          <>
            <Box>
              <Text fontSize="lg" fontWeight="bold" color="red.500">
                Update Error
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {error.message}
              </Text>
            </Box>

            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Dismiss
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
};
