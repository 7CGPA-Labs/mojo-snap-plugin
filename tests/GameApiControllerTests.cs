using System;
using System.IO;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Entities;
using MojoSnapPlugin.Api;

namespace MojoSnapPlugin.Tests
{
    public class GameApiControllerTests
    {
        [Fact]
        public void GetRomStream_ItemNotFound_ReturnsNotFound()
        {
            // Arrange
            var mockLibraryManager = new Mock<ILibraryManager>();
            mockLibraryManager.Setup(m => m.GetItemById(It.IsAny<Guid>())).Returns((BaseItem?)null);
            var controller = new GameApiController(mockLibraryManager.Object);

            // Act
            var result = controller.GetRomStream(Guid.NewGuid());

            // Assert
            var notFoundResult = Assert.IsType<NotFoundObjectResult>(result);
            Assert.Equal("Game ROM not found in media library.", notFoundResult.Value);
        }

        [Fact]
        public void GetRomStream_ItemPathEmpty_ReturnsNotFound()
        {
            // Arrange
            var mockLibraryManager = new Mock<ILibraryManager>();
            var mockItem = new Mock<BaseItem>();
            mockItem.SetupGet(i => i.Path).Returns(string.Empty);
            
            mockLibraryManager.Setup(m => m.GetItemById(It.IsAny<Guid>())).Returns(mockItem.Object);
            var controller = new GameApiController(mockLibraryManager.Object);

            // Act
            var result = controller.GetRomStream(Guid.NewGuid());

            // Assert
            var notFoundResult = Assert.IsType<NotFoundObjectResult>(result);
            Assert.Equal("Game ROM not found in media library.", notFoundResult.Value);
        }
    }
}
