import { ObjectId } from 'mongodb';
import userUtils from '../utils/user';
import fileUtils from '../utils/file';
import basicUtils from '../utils/basic';

class FilesController {
  /**
   * GET /files
   * Returns a list of files filtered by parentId and paginated
   */
  static async getIndex(request, response) {
    try {
      // 1️⃣ Verify user
      const { userId } = await userUtils.getUserIdAndKey(request);
      if (!userId) {
        return response.status(401).send({ error: 'Unauthorized' });
      }

      const user = await userUtils.getUser({ _id: ObjectId(userId) });
      if (!user) {
        return response.status(401).send({ error: 'Unauthorized' });
      }

      // 2️⃣ Handle query params
      let { parentId, page } = request.query;

      if (!parentId) parentId = 0; // default to root
      page = Number(page) || 0;
      if (Number.isNaN(page) || page < 0) page = 0;

      // 3️⃣ Prepare match stage
      const matchStage = { userId: ObjectId(userId) };

      if (parentId !== 0 && parentId !== '0') {
        // Check if valid ObjectId
        if (!basicUtils.isValidId(parentId)) {
          return response.status(404).send([]);
        }

        const folder = await fileUtils.getFile({ _id: ObjectId(parentId) });

        // Parent must be a valid folder
        if (!folder || folder.type !== 'folder') {
          return response.status(200).send([]);
        }

        matchStage.parentId = ObjectId(parentId);
      } else {
        // Root files
        matchStage.parentId = 0;
      }

      // 4️⃣ Pagination pipeline
      const pipeline = [
        { $match: matchStage },
        { $skip: page * 20 },
        { $limit: 20 },
      ];

      const fileCursor = await fileUtils.getFilesOfParentId(pipeline);

      const files = [];
      await fileCursor.forEach((doc) => {
        files.push(fileUtils.processFile(doc));
      });

      return response.status(200).send(files);
    } catch (err) {
      // 5️⃣ Catch errors
      console.error('Error in GET /files:', err);
      return response.status(500).send({ error: 'Server error' });
    }
  }

  /**
   * GET /files/:id
   * (assuming you have this from before — unchanged)
   */
  static async getShow(request, response) {
    try {
      const { userId } = await userUtils.getUserIdAndKey(request);
      if (!userId) {
        return response.status(401).send({ error: 'Unauthorized' });
      }

      const user = await userUtils.getUser({ _id: ObjectId(userId) });
      if (!user) {
        return response.status(401).send({ error: 'Unauthorized' });
      }

      const fileId = request.params.id;
      if (!basicUtils.isValidId(fileId)) {
        return response.status(404).send({ error: 'Not found' });
      }

      const file = await fileUtils.getFile({ _id: ObjectId(fileId), userId: ObjectId(userId) });
      if (!file) {
        return response.status(404).send({ error: 'Not found' });
      }

      return response.status(200).send(fileUtils.processFile(file));
    } catch (err) {
      console.error('Error in GET /files/:id:', err);
      return response.status(500).send({ error: 'Server error' });
    }
  }
}

export default FilesController;
